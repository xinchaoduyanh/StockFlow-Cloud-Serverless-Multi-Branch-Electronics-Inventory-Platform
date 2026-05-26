import { Injectable, Logger } from "@nestjs/common";
import { ReconciliationStatus } from "@prisma/client";
import { ApiErrors } from "../common/errors/api-error";
import { toPagination } from "../common/schemas/pagination.schema";
import { EnvService } from "../config/env.service";
import { PrismaService } from "../database/prisma.service";
import { ReconciliationListQuery } from "./reconciliation.schemas";

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly envService: EnvService,
  ) {}

  async listIssues(query: ReconciliationListQuery) {
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
    });
  }

  async run() {
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

  async resolve(id: string) {
    const issue = await this.prisma.reconciliationIssue.findUnique({ where: { id } });

    if (!issue) {
      throw ApiErrors.notFound("Reconciliation issue not found");
    }

    if (issue.status !== ReconciliationStatus.OPEN) {
      throw ApiErrors.badRequest(`Issue is already ${issue.status}`);
    }

    return this.prisma.reconciliationIssue.update({
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
  }

  private async runSync() {
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
        } else {
          await this.prisma.reconciliationIssue.create({
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
    const { LambdaClient, InvokeCommand } = await import("@aws-sdk/client-lambda");
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
