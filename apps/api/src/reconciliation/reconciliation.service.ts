import { Injectable, Logger } from "@nestjs/common";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import {
  ReconciliationListQuery,
  ReconciliationIssue,
  ReconciliationRunResponse,
  ReconciliationStatus,
} from "@stockflow/shared";
import { ApiErrors } from "../common/errors/api-error";
import { toPagination } from "../common/schemas/pagination.schema";
import { EnvService } from "../config/env.service";
import { PrismaService } from "../database/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly envService: EnvService,
    private readonly notifications: NotificationsService,
  ) {}

  async listIssues(query: ReconciliationListQuery): Promise<ReconciliationIssue[]> {
    const { skip, take } = toPagination(query);

    return this.prisma.reconciliationIssue.findMany({
      skip,
      take,
      where: query.status ? { status: query.status } : {},
      include: {
        branch: { select: { code: true, name: true } },
        component: { select: { sku: true, name: true } },
      },
      orderBy: { detectedAt: "desc" },
    }) as unknown as Promise<ReconciliationIssue[]>;
  }

  async run(): Promise<ReconciliationRunResponse> {
    const lambdaArn = this.envService.get("RECONCILIATION_LAMBDA_ARN");

    if (lambdaArn) {
      await this.invokeLambda(lambdaArn, { dryRun: false });
      this.logger.log("Reconciliation dispatched to Lambda");
      return { status: "DISPATCHED", message: "Reconciliation job dispatched to Lambda" };
    }

    // Sync fallback for local dev
    this.logger.warn("No Lambda ARN — running reconciliation synchronously");
    return this.runSync();
  }

  async resolve(id: string): Promise<ReconciliationIssue> {
    return this.prisma.$transaction(async (tx) => {
      const issue = await tx.reconciliationIssue.findUnique({ where: { id } });

      if (!issue) {
        throw ApiErrors.notFound("Reconciliation issue not found");
      }

      if (issue.status !== ReconciliationStatus.OPEN) {
        throw ApiErrors.badRequest(`Issue is already ${issue.status}`);
      }

      // Create compensating StockMovement
      await tx.stockMovement.create({
        data: {
          branchId: issue.branchId,
          componentId: issue.componentId,
          quantityChange: issue.difference,
          movementType: "RECONCILIATION_ADJUSTMENT",
          referenceType: "INVENTORY_ADJUSTMENT",
          referenceId: issue.id,
        },
      });

      return tx.reconciliationIssue.update({
        where: { id },
        data: {
          status: ReconciliationStatus.RESOLVED,
          resolvedAt: new Date(),
        },
        include: {
          branch: { select: { code: true, name: true } },
          component: { select: { sku: true, name: true } },
        },
      });
    }) as unknown as Promise<ReconciliationIssue>;
  }

  private async runSync(): Promise<ReconciliationRunResponse> {
    const runId = `recon-sync-${Date.now()}`;
    const inventoryRecords = await this.prisma.inventory.findMany({
      include: {
        branch: { select: { code: true } },
        component: { select: { sku: true } },
      },
    });

    let mismatches = 0;

    for (const record of inventoryRecords) {
      const movementSum = await this.prisma.stockMovement.aggregate({
        where: {
          branchId: record.branchId,
          componentId: record.componentId,
        },
        _sum: { quantityChange: true },
      });

      const expected = movementSum._sum.quantityChange || 0;
      const difference = record.quantity - expected;

      if (difference !== 0) {
        mismatches++;

        const existing = await this.prisma.reconciliationIssue.findFirst({
          where: {
            branchId: record.branchId,
            componentId: record.componentId,
            status: ReconciliationStatus.OPEN,
          },
        });

        let issueId: string;

        if (existing) {
          await this.prisma.reconciliationIssue.update({
            where: { id: existing.id },
            data: {
              expectedQuantity: expected,
              actualQuantity: record.quantity,
              difference,
              runId,
              detectedAt: new Date(),
            },
          });
          issueId = existing.id;
        } else {
          const created = await this.prisma.reconciliationIssue.create({
            data: {
              branchId: record.branchId,
              componentId: record.componentId,
              expectedQuantity: expected,
              actualQuantity: record.quantity,
              difference,
              status: ReconciliationStatus.OPEN,
              runId,
            },
          });
          issueId = created.id;
        }

        // Notify admins
        const admins = await this.prisma.user.findMany({
          where: { role: "ADMIN" },
        });

        for (const admin of admins) {
          try {
            await this.notifications.createNotification({
              userId: admin.id,
              title: "Cảnh báo đối soát tồn kho",
              message: `Phát hiện sai lệch tại chi nhánh ${record.branch.code} đối với sản phẩm SKU ${record.component.sku} (chênh lệch: ${difference})`,
              type: "RECONCILIATION_ALERT",
              metadata: {
                issueId,
                branchId: record.branchId,
                branchCode: record.branch.code,
                sku: record.component.sku,
                difference,
              },
            });
          } catch (err: any) {
            this.logger.error(`Failed to create admin notification: ${err.message}`);
          }
        }
      }
    }

    return {
      status: "COMPLETED",
      runId,
      totalRecords: inventoryRecords.length,
      mismatches,
    };
  }

  private async invokeLambda(arn: string, payload: Record<string, unknown>) {
    const region = this.envService.get("AWS_REGION");
    const client = new LambdaClient({ region });

    await client.send(
      new InvokeCommand({
        FunctionName: arn,
        InvocationType: "Event",
        Payload: Buffer.from(JSON.stringify(payload)),
      }),
    );
  }
}
