import { DlqListQuery, ImportJobDTO } from "@stockflow/shared";
import { Injectable, Logger } from "@nestjs/common";
import { ImportStatus } from "@prisma/client";
import { ApiErrors } from "../common/errors/api-error";
import { toPagination } from "../common/schemas/pagination.schema";
import { PrismaService } from "../database/prisma.service";
import { AuthorizationPolicyService, PolicyActor } from "../auth/authorization-policy.service";
import { RecoveryService } from "../recovery/recovery.service";

@Injectable()
export class DlqService {
  private readonly logger = new Logger(DlqService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationPolicyService,
    private readonly recovery: RecoveryService,
  ) {}

  async listFailedJobs(query: DlqListQuery, actor?: PolicyActor): Promise<ImportJobDTO[]> {
    if (actor) this.authorization.assertAdmin(actor);
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

  async replay(id: string, reason: string, actor?: PolicyActor) {
    if (actor) this.authorization.assertAdmin(actor);
    const job = await this.prisma.importJob.findUnique({ where: { id } });

    if (!job) {
      throw ApiErrors.notFound("Import job not found");
    }

    if (job.status !== ImportStatus.FAILED && job.status !== ImportStatus.PARTIAL_FAILED) {
      throw ApiErrors.badRequest(`Job status is ${job.status}, not FAILED/PARTIAL_FAILED`);
    }

    const recoveryItem = await this.prisma.importRecoveryItem.findFirst({
      where: { importJobId: id, status: "OPEN" },
    });
    if (!recoveryItem)
      throw ApiErrors.badRequest("No open recovery item exists for this import job");
    await this.recovery.replayImport(recoveryItem.id, { reason }, actor);

    return this.prisma.importJob.findUnique({
      where: { id },
      include: { branch: true },
    });
  }

  async discard(id: string, reason: string, actor?: PolicyActor) {
    if (actor) this.authorization.assertAdmin(actor);
    const job = await this.prisma.importJob.findUnique({ where: { id } });

    if (!job) {
      throw ApiErrors.notFound("Import job not found");
    }

    if (job.status !== ImportStatus.FAILED && job.status !== ImportStatus.PARTIAL_FAILED) {
      throw ApiErrors.badRequest(`Job status is ${job.status}, cannot discard`);
    }

    const recoveryItem = await this.prisma.importRecoveryItem.findFirst({
      where: { importJobId: id, status: "OPEN" },
    });
    if (!recoveryItem)
      throw ApiErrors.badRequest("No open recovery item exists for this import job");
    await this.recovery.discardImport(recoveryItem.id, { reason }, actor);
    return this.prisma.importJob.findUnique({ where: { id }, include: { branch: true } });
  }
}
