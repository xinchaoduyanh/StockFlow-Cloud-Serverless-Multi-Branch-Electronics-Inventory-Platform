import {
  canReplayImportRecovery,
  ImportRecoveryListQuery,
  ImportRecoveryItemDTO,
  ReportDlqRedriveBody,
  ReportRecoveryDTO,
  ReportRecoveryListQuery,
  RecoveryActionBody,
  sanitizeAuditSummary,
} from "@stockflow/shared";
import {
  GetQueueAttributesCommand,
  ListMessageMoveTasksCommand,
  SQSClient,
  StartMessageMoveTaskCommand,
} from "@aws-sdk/client-sqs";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { ForbiddenException, Injectable } from "@nestjs/common";
import {
  ExportJobStatus,
  ImportRowStatus,
  ImportStatus,
  Prisma,
  RecoveryItemStatus,
} from "@prisma/client";
import { ApiErrors } from "../common/errors/api-error";
import { toPagination } from "../common/schemas/pagination.schema";
import { AuthorizationPolicyService, PolicyActor } from "../auth/authorization-policy.service";
import { EnvService } from "../config/env.service";
import { PrismaService } from "../database/prisma.service";
import { ReportDispatcher } from "../reports/report-dispatcher";

const MAX_REPORT_REPLAYS = 3;

@Injectable()
export class RecoveryService {
  private readonly sqs: SQSClient;
  private readonly sfn: SFNClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly env: EnvService,
    private readonly authorization: AuthorizationPolicyService,
    private readonly reportDispatcher: ReportDispatcher,
  ) {
    this.sqs = new SQSClient({ region: this.env.get("AWS_REGION") });
    this.sfn = new SFNClient({ region: this.env.get("AWS_REGION") });
  }

  async listReports(
    query: ReportRecoveryListQuery,
    actor?: PolicyActor,
  ): Promise<ReportRecoveryDTO[]> {
    this.requireAdmin(actor);
    const { skip, take } = toPagination(query);
    const jobs = await this.prisma.exportJob.findMany({
      skip,
      take,
      where: {
        status: query.status
          ? (query.status as ExportJobStatus)
          : { in: [ExportJobStatus.FAILED, ExportJobStatus.DISCARDED] },
      },
      orderBy: { createdAt: "desc" },
    });
    return jobs.map((job) => ({
      id: job.id,
      reportType: String(job.reportType),
      status: String(job.status),
      attemptCount: job.attemptCount,
      lastErrorCode: job.lastErrorCode,
      errorMessage: job.errorMessage,
      discardReason: job.discardReason,
      createdBy: job.createdBy,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    }));
  }

  async reportQueueMetrics(actor?: PolicyActor) {
    this.requireAdmin(actor);
    const queueUrl = this.env.get("REPORT_QUEUE_URL");
    const dlqUrl = this.env.get("REPORT_QUEUE_DLQ_URL");
    if (!queueUrl || !dlqUrl)
      throw ApiErrors.badRequest("Report queue configuration is incomplete");

    const [queue, dlq] = await Promise.all([
      this.sqs.send(new GetQueueAttributesCommand({ QueueUrl: queueUrl, AttributeNames: ["All"] })),
      this.sqs.send(new GetQueueAttributesCommand({ QueueUrl: dlqUrl, AttributeNames: ["All"] })),
    ]);
    return {
      source: this.queueMetrics(queue.Attributes),
      dlq: this.queueMetrics(dlq.Attributes),
      alarms: {
        dlqVisible: `${this.env.get("AWS_REGION")} / ${dlqUrl}`,
        queueAgeThresholdSeconds: 900,
      },
      runbook: "docs/runbooks/e3-recovery.md",
    };
  }

  async replayReport(id: string, body: RecoveryActionBody, actor?: PolicyActor) {
    const admin = this.requireAdmin(actor);
    const claimed = await this.prisma.$transaction(async (tx) => {
      const job = await tx.exportJob.findUnique({ where: { id } });
      if (!job) throw ApiErrors.notFound("Report export job not found");
      if (job.status === ExportJobStatus.COMPLETED || job.status === ExportJobStatus.DISCARDED) {
        throw ApiErrors.conflict(`Report job is already ${job.status}`);
      }
      if (
        job.status !== ExportJobStatus.FAILED ||
        job.attemptCount >= MAX_REPORT_REPLAYS * Number(this.env.get("REPORT_MAX_RECEIVE_COUNT"))
      ) {
        throw ApiErrors.badRequest("Report replay limit or status does not allow replay");
      }
      const maxAttempts = MAX_REPORT_REPLAYS * Number(this.env.get("REPORT_MAX_RECEIVE_COUNT"));
      const claim = await tx.exportJob.updateMany({
        where: {
          id,
          status: ExportJobStatus.FAILED,
          attemptCount: { lt: maxAttempts },
        },
        data: {
          status: ExportJobStatus.PENDING,
          errorMessage: null,
          lastErrorCode: null,
          discardReason: null,
        },
      });
      if (claim.count !== 1) {
        throw ApiErrors.conflict("Report recovery job was claimed by another operator");
      }
      const updated = await tx.exportJob.findUniqueOrThrow({ where: { id } });
      await tx.auditLog.create({
        data: {
          actorId: this.actorId(admin),
          action: "REPORT_REPLAY_REQUESTED",
          resourceType: "ExportJob",
          resourceId: id,
          reason: body.reason,
          beforeSummary: this.auditJson({ status: job.status, attemptCount: job.attemptCount }),
          afterSummary: this.auditJson({
            status: updated.status,
            attemptCount: updated.attemptCount,
          }),
        },
      });
      return updated;
    });

    try {
      await this.reportDispatcher.dispatch(claimed.id);
      return this.prisma.exportJob.findUnique({ where: { id } });
    } catch (error) {
      await this.prisma.$transaction([
        this.prisma.exportJob.update({
          where: { id },
          data: {
            status: ExportJobStatus.FAILED,
            lastErrorCode: "DISPATCH_FAILED",
            errorMessage: "Report replay dispatch failed.",
          },
        }),
        this.prisma.auditLog.create({
          data: {
            actorId: this.actorId(admin),
            action: "REPORT_REPLAY_DISPATCH_FAILED",
            resourceType: "ExportJob",
            resourceId: id,
            reason: body.reason,
            metadata: this.auditJson({
              errorCode: error instanceof Error ? error.name : "UNKNOWN",
            }),
          },
        }),
      ]);
      throw ApiErrors.badRequest("Report replay dispatch failed");
    }
  }

  async discardReport(id: string, body: RecoveryActionBody, actor?: PolicyActor) {
    const admin = this.requireAdmin(actor);
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.exportJob.findUnique({ where: { id } });
      if (!job) throw ApiErrors.notFound("Report export job not found");
      if (job.status === ExportJobStatus.COMPLETED || job.status === ExportJobStatus.DISCARDED) {
        throw ApiErrors.conflict(`Report job is already ${job.status}`);
      }
      if (job.status !== ExportJobStatus.FAILED) {
        throw ApiErrors.badRequest("Only failed report jobs can be discarded");
      }
      const claim = await tx.exportJob.updateMany({
        where: { id, status: ExportJobStatus.FAILED },
        data: { status: ExportJobStatus.DISCARDED, discardReason: body.reason, errorMessage: null },
      });
      if (claim.count !== 1) {
        throw ApiErrors.conflict("Report recovery job was claimed by another operator");
      }
      const updated = await tx.exportJob.findUniqueOrThrow({ where: { id } });
      await tx.auditLog.create({
        data: {
          actorId: this.actorId(admin),
          action: "REPORT_DISCARDED",
          resourceType: "ExportJob",
          resourceId: id,
          reason: body.reason,
          beforeSummary: this.auditJson({ status: job.status, attemptCount: job.attemptCount }),
          afterSummary: this.auditJson({ status: updated.status, discardReason: body.reason }),
        },
      });
      return updated;
    });
  }

  async redriveReportDlq(body: ReportDlqRedriveBody, actor?: PolicyActor) {
    const admin = this.requireAdmin(actor);
    const sourceUrl = this.env.get("REPORT_QUEUE_DLQ_URL");
    const destinationUrl = this.env.get("REPORT_QUEUE_URL");
    if (!sourceUrl || !destinationUrl)
      throw ApiErrors.badRequest("Report DLQ configuration is incomplete");

    const active = await this.sqs.send(
      new ListMessageMoveTasksCommand({ SourceArn: await this.queueArn(sourceUrl) }),
    );
    if ((active.Results ?? []).some((task) => task.Status === "RUNNING")) {
      throw ApiErrors.conflict("A report DLQ redrive is already running");
    }
    const result = await this.sqs.send(
      new StartMessageMoveTaskCommand({
        SourceArn: await this.queueArn(sourceUrl),
        DestinationArn: await this.queueArn(destinationUrl),
        MaxNumberOfMessagesPerSecond: body.maxMessagesPerSecond,
      }),
    );
    await this.prisma.auditLog.create({
      data: {
        actorId: this.actorId(admin),
        action: "REPORT_DLQ_REDRIVE_STARTED",
        resourceType: "SQSQueue",
        resourceId: sourceUrl,
        reason: body.reason,
        metadata: this.auditJson({
          taskHandle: result.TaskHandle,
          maxMessagesPerSecond: body.maxMessagesPerSecond,
        }),
      },
    });
    return { taskHandle: result.TaskHandle, maxMessagesPerSecond: body.maxMessagesPerSecond };
  }

  async listImportRecovery(
    query: ImportRecoveryListQuery,
    actor?: PolicyActor,
  ): Promise<ImportRecoveryItemDTO[]> {
    this.requireAdmin(actor);
    const { skip, take } = toPagination(query);
    const items = await this.prisma.importRecoveryItem.findMany({
      skip,
      take,
      where: {
        status: query.status ? (query.status as RecoveryItemStatus) : undefined,
        importJobId: query.importJobId,
      },
      orderBy: { createdAt: "desc" },
    });
    return items.map((item) => item as unknown as ImportRecoveryItemDTO);
  }

  async replayImport(id: string, body: RecoveryActionBody, actor?: PolicyActor) {
    const admin = this.requireAdmin(actor);
    const claimed = await this.prisma.$transaction(async (tx) => {
      const item = await tx.importRecoveryItem.findUnique({ where: { id } });
      if (!item) throw ApiErrors.notFound("Import recovery item not found");
      const maxReplayCount = Number(this.env.get("IMPORT_MAX_REPLAY_COUNT"));
      if (!canReplayImportRecovery(item.status as never, item.replayCount, maxReplayCount)) {
        throw ApiErrors.badRequest("Import recovery replay limit or status does not allow replay");
      }
      const job = await tx.importJob.findUnique({ where: { id: item.importJobId } });
      if (!job) throw ApiErrors.notFound("Import job not found");
      const claim = await tx.importRecoveryItem.updateMany({
        where: {
          id,
          status: RecoveryItemStatus.OPEN,
          replayCount: { lt: maxReplayCount },
        },
        data: {
          status: RecoveryItemStatus.REPLAYING,
          replayCount: { increment: 1 },
          lastActionBy: this.actorId(admin),
          lastActionReason: body.reason,
          lastReplayedAt: new Date(),
        },
      });
      if (claim.count !== 1) {
        throw ApiErrors.conflict("Import recovery item was claimed by another operator");
      }
      const updatedItem = await tx.importRecoveryItem.findUniqueOrThrow({ where: { id } });
      await tx.importJobRow.updateMany({
        where: {
          importJobId: job.id,
          validationStatus: ImportRowStatus.FAILED,
        },
        data: {
          validationStatus: ImportRowStatus.VALID,
          errorMessage: null,
          processedAt: null,
        },
      });
      await tx.importJob.update({
        where: { id: job.id },
        data: {
          status: ImportStatus.UPLOADED,
          errorMessage: null,
          awsTaskToken: null,
          executionArn: null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: this.actorId(admin),
          action: "IMPORT_REPLAY_REQUESTED",
          resourceType: "ImportRecoveryItem",
          resourceId: id,
          reason: body.reason,
          beforeSummary: this.auditJson({
            status: item.status,
            replayCount: item.replayCount,
            importJobId: item.importJobId,
          }),
          afterSummary: this.auditJson({
            status: updatedItem.status,
            replayCount: updatedItem.replayCount,
          }),
        },
      });
      return { item: updatedItem, job, replayNumber: updatedItem.replayCount };
    });

    try {
      const name = `stockflow-${claimed.job.id.slice(0, 8)}-replay-${claimed.replayNumber}`;
      const started = await this.sfn.send(
        new StartExecutionCommand({
          stateMachineArn: this.env.get("IMPORT_STATE_MACHINE_ARN"),
          name,
          input: JSON.stringify({
            importJobId: claimed.job.id,
            bucket: this.env.get("AWS_S3_BUCKET"),
            key: claimed.job.s3Key,
            replayOf: claimed.item.id,
          }),
        }),
      );
      await this.prisma.importJob.update({
        where: { id: claimed.job.id },
        data: { executionArn: started.executionArn },
      });
      return this.prisma.importRecoveryItem.findUnique({ where: { id } });
    } catch (error) {
      await this.prisma.$transaction([
        this.prisma.importRecoveryItem.update({
          where: { id },
          data: { status: RecoveryItemStatus.OPEN },
        }),
        this.prisma.importJob.update({
          where: { id: claimed.job.id },
          data: {
            status: ImportStatus.FAILED,
            errorMessage: "Import recovery replay dispatch failed.",
          },
        }),
        this.prisma.auditLog.create({
          data: {
            actorId: this.actorId(admin),
            action: "IMPORT_RECOVERY_REPLAY_DISPATCH_FAILED",
            resourceType: "ImportRecoveryItem",
            resourceId: id,
            reason: body.reason,
            metadata: this.auditJson({
              errorCode: error instanceof Error ? error.name : "UNKNOWN",
            }),
          },
        }),
      ]);
      throw ApiErrors.badRequest("Import recovery replay dispatch failed");
    }
  }

  async discardImport(id: string, body: RecoveryActionBody, actor?: PolicyActor) {
    const admin = this.requireAdmin(actor);
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.importRecoveryItem.findUnique({ where: { id } });
      if (!item) throw ApiErrors.notFound("Import recovery item not found");
      if (item.status !== RecoveryItemStatus.OPEN)
        throw ApiErrors.conflict(`Recovery item is already ${item.status}`);
      const claim = await tx.importRecoveryItem.updateMany({
        where: { id, status: RecoveryItemStatus.OPEN },
        data: {
          status: RecoveryItemStatus.DISCARDED,
          discardedAt: new Date(),
          lastActionBy: this.actorId(admin),
          lastActionReason: body.reason,
        },
      });
      if (claim.count !== 1) {
        throw ApiErrors.conflict("Import recovery item was claimed by another operator");
      }
      const updated = await tx.importRecoveryItem.findUniqueOrThrow({ where: { id } });
      await tx.importJob.update({
        where: { id: item.importJobId },
        data: {
          status: ImportStatus.CANCELLED,
          errorMessage: "Import discarded by recovery operator.",
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: this.actorId(admin),
          action: "IMPORT_DISCARDED",
          resourceType: "ImportRecoveryItem",
          resourceId: id,
          reason: body.reason,
          beforeSummary: this.auditJson({ status: item.status, importJobId: item.importJobId }),
          afterSummary: this.auditJson({ status: updated.status }),
        },
      });
      return updated;
    });
  }

  private queueMetrics(attributes?: Record<string, string>) {
    const value = (name: string) => Number(attributes?.[name] ?? 0);
    return {
      availableMessages: value("ApproximateNumberOfMessagesVisible"),
      inFlightMessages: value("ApproximateNumberOfMessagesNotVisible"),
      oldestMessageAgeSeconds: attributes?.ApproximateAgeOfOldestMessage
        ? value("ApproximateAgeOfOldestMessage")
        : null,
    };
  }

  private async queueArn(queueUrl: string) {
    const response = await this.sqs.send(
      new GetQueueAttributesCommand({ QueueUrl: queueUrl, AttributeNames: ["QueueArn"] }),
    );
    const arn = response.Attributes?.QueueArn;
    if (!arn) throw ApiErrors.badRequest("Queue ARN is unavailable");
    return arn;
  }

  private requireAdmin(actor?: PolicyActor) {
    if (!actor) throw new ForbiddenException("Authentication is required");
    this.authorization.assertAdmin(actor);
    return actor;
  }

  private actorId(actor: PolicyActor) {
    return actor.sub ?? actor.id;
  }

  private auditJson(value: unknown): Prisma.InputJsonValue {
    return sanitizeAuditSummary(value) as Prisma.InputJsonValue;
  }
}
