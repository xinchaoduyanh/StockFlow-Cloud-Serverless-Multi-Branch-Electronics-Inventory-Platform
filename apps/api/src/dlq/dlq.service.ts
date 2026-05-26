import { DlqListQuery, ImportJobDTO } from "@stockflow/shared";
import { Injectable, Logger } from "@nestjs/common";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { ImportStatus } from "@prisma/client";
import { ApiErrors } from "../common/errors/api-error";
import { toPagination } from "../common/schemas/pagination.schema";
import { EnvService } from "../config/env.service";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class DlqService {
  private readonly logger = new Logger(DlqService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly envService: EnvService,
  ) {}

  async listFailedJobs(query: DlqListQuery): Promise<ImportJobDTO[]> {
    const { skip, take } = toPagination(query);

    return this.prisma.importJob.findMany({
      skip,
      take,
      where: {
        status: { in: [ImportStatus.FAILED, ImportStatus.PARTIAL_FAILED] },
        ...(query.branchId ? { branchId: query.branchId } : {}),
      },
      include: { branch: true },
      orderBy: { createdAt: "desc" },
    }) as any;
  }

  async replay(id: string) {
    const job = await this.prisma.importJob.findUnique({ where: { id } });

    if (!job) {
      throw ApiErrors.notFound("Import job not found");
    }

    if (job.status !== ImportStatus.FAILED && job.status !== ImportStatus.PARTIAL_FAILED) {
      throw ApiErrors.badRequest(`Job status is ${job.status}, not FAILED/PARTIAL_FAILED`);
    }

    const lambdaArn = this.envService.get("DLQ_REPLAY_LAMBDA_ARN");

    if (lambdaArn) {
      await this.invokeLambda(lambdaArn, { importJobId: id });
      this.logger.log(`DLQ replay for ${id} dispatched to Lambda`);
    } else {
      // Sync fallback: reset job status so the polling loop or manual confirm can pick it up
      this.logger.warn(`No Lambda ARN — resetting job ${id} to UPLOADED for manual retry`);

      await this.prisma.importJobRow.deleteMany({ where: { importJobId: id } });
      await this.prisma.importJob.update({
        where: { id },
        data: {
          status: ImportStatus.UPLOADED,
          errorMessage: null,
          awsTaskToken: null,
          committedRows: 0,
        },
      });
    }

    return this.prisma.importJob.findUnique({
      where: { id },
      include: { branch: true },
    });
  }

  async discard(id: string) {
    const job = await this.prisma.importJob.findUnique({ where: { id } });

    if (!job) {
      throw ApiErrors.notFound("Import job not found");
    }

    if (job.status !== ImportStatus.FAILED && job.status !== ImportStatus.PARTIAL_FAILED) {
      throw ApiErrors.badRequest(`Job status is ${job.status}, cannot discard`);
    }

    return this.prisma.importJob.update({
      where: { id },
      data: { status: ImportStatus.CANCELLED },
      include: { branch: true },
    });
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
