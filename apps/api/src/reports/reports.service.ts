import { ReportType, CreateExportBody, ExportListQuery, ExportJobDTO } from "@stockflow/shared";
import { Injectable, Logger } from "@nestjs/common";
import { ExportJobStatus, ReportType as PrismaReportType, type ExportJob } from "@prisma/client";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ApiErrors } from "../common/errors/api-error";
import { toPagination } from "../common/schemas/pagination.schema";
import { EnvService } from "../config/env.service";
import { PrismaService } from "../database/prisma.service";
import { S3Service } from "../imports/s3.service";
import { AuthorizationPolicyService, PolicyActor } from "../auth/authorization-policy.service";
import { ReportDispatcher } from "./report-dispatcher";

const prismaReportTypeByExternal: Record<ReportType, PrismaReportType> = {
  [ReportType.INVENTORY]: PrismaReportType.INVENTORY,
  [ReportType.LOW_STOCK]: PrismaReportType.LOW_STOCK,
  [ReportType.TRANSFERS]: PrismaReportType.TRANSFERS,
  [ReportType.IMPORT_HISTORY]: PrismaReportType.IMPORT_HISTORY,
  [ReportType.STOCK_MOVEMENTS]: PrismaReportType.STOCK_MOVEMENTS,
};

const externalReportTypeByPrisma: Record<PrismaReportType, ReportType> = {
  [PrismaReportType.INVENTORY]: ReportType.INVENTORY,
  [PrismaReportType.LOW_STOCK]: ReportType.LOW_STOCK,
  [PrismaReportType.TRANSFERS]: ReportType.TRANSFERS,
  [PrismaReportType.IMPORT_HISTORY]: ReportType.IMPORT_HISTORY,
  [PrismaReportType.STOCK_MOVEMENTS]: ReportType.STOCK_MOVEMENTS,
};

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly envService: EnvService,
    private readonly s3Service: S3Service,
    private readonly authorization: AuthorizationPolicyService,
    private readonly dispatcher: ReportDispatcher,
  ) {}

  async createExport(input: CreateExportBody, actor?: PolicyActor): Promise<ExportJobDTO> {
    const actorId = actor?.sub ?? actor?.id;
    const branchId = input.filters?.branchId ?? actor?.branchId;
    if (actor) this.authorization.assertCanCreateReport(actor, branchId);
    const filters = { ...(input.filters ?? {}), ...(actor?.role !== "ADMIN" ? { branchId } : {}) };
    const job = await this.prisma.exportJob.create({
      data: {
        reportType: prismaReportTypeByExternal[input.reportType],
        status: ExportJobStatus.PENDING,
        filters: filters ?? undefined,
        createdBy: actorId,
      },
    });

    try {
      if (this.envService.get("REPORT_DISPATCH_MODE") === "local") {
        this.logger.warn(`Report export ${job.id} running in local synchronous mode`);
        await this.runExportSync(job.id);
      } else {
        await this.dispatcher.dispatch(job.id);
        this.logger.log(`Report export ${job.id} dispatched to SQS`);
      }
    } catch (error) {
      await this.prisma.exportJob.update({
        where: { id: job.id },
        data: {
          status: ExportJobStatus.FAILED,
          lastErrorCode: "DISPATCH_FAILED",
          errorMessage: "Report dispatch failed; retry the report from recovery operations.",
        },
      });
      this.logger.error(`Report export ${job.id} dispatch failed`, error);
      throw ApiErrors.badRequest("Report dispatch failed");
    }

    return this.getExport(job.id, actor);
  }

  async listExports(query: ExportListQuery, actor?: PolicyActor): Promise<ExportJobDTO[]> {
    const { skip, take } = toPagination(query);
    const jobs = await this.prisma.exportJob.findMany({
      skip,
      take,
      where: actor && actor.role !== "ADMIN" ? { createdBy: actor.sub ?? actor.id } : undefined,
      orderBy: { createdAt: "desc" },
    });
    return jobs.map((job) => this.serializeExportJob(job)) as any;
  }

  async getExport(id: string, actor?: PolicyActor): Promise<ExportJobDTO> {
    const job = await this.prisma.exportJob.findUnique({ where: { id } });
    if (!job) throw ApiErrors.notFound("Export job not found");
    if (actor) {
      const filters = (job.filters as { branchId?: string } | null) ?? null;
      this.authorization.assertCanReadReport(actor, filters?.branchId, job.createdBy);
    }
    return this.serializeExportJob(job) as any;
  }

  async getDownloadUrl(id: string, actor?: PolicyActor) {
    const job = await this.getExport(id, actor);

    if (job.status !== ExportJobStatus.COMPLETED || !job.s3Key) {
      throw ApiErrors.badRequest("Export is not ready for download");
    }

    const region = this.envService.get("AWS_REGION");
    const accessKeyId = this.envService.get("AWS_ACCESS_KEY_ID");
    const secretAccessKey = this.envService.get("AWS_SECRET_ACCESS_KEY");
    const endpoint = this.envService.get("AWS_S3_ENDPOINT");

    const s3Client = new S3Client({
      region,
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
      endpoint: endpoint || undefined,
      forcePathStyle: endpoint ? true : undefined,
    });

    const command = new GetObjectCommand({
      Bucket: this.envService.get("AWS_S3_BUCKET"),
      Key: job.s3Key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 600 });

    return { url, fileName: job.fileName };
  }

  private serializeExportJob(job: ExportJob): any {
    return { ...job, reportType: this.toExternalReportType(job.reportType) };
  }

  private toExternalReportType(reportType: PrismaReportType): ReportType {
    return externalReportTypeByPrisma[reportType];
  }

  private async runExportSync(exportJobId: string) {
    const job = await this.prisma.exportJob.findUnique({ where: { id: exportJobId } });
    if (!job) return;

    try {
      await this.prisma.exportJob.update({
        where: { id: exportJobId },
        data: { status: ExportJobStatus.PROCESSING },
      });

      const filters = (job.filters as Record<string, any>) || {};
      let totalRecords: number;

      switch (job.reportType) {
        case PrismaReportType.INVENTORY:
          ({ total: totalRecords } = await this.generateInventoryReport(filters));
          break;
        case PrismaReportType.LOW_STOCK:
          ({ total: totalRecords } = await this.generateLowStockReport(filters));
          break;
        default:
          ({ total: totalRecords } = await this.generateInventoryReport(filters));
      }

      // For local dev without S3, just mark as complete with data in DB
      await this.prisma.exportJob.update({
        where: { id: exportJobId },
        data: {
          status: ExportJobStatus.COMPLETED,
          totalRecords,
          fileName: `${this.toExternalReportType(job.reportType)}-${Date.now()}.csv`,
          completedAt: new Date(),
        },
      });
    } catch (err: any) {
      await this.prisma.exportJob.update({
        where: { id: exportJobId },
        data: {
          status: ExportJobStatus.FAILED,
          errorMessage: err.message,
        },
      });
    }
  }

  private async generateInventoryReport(filters: Record<string, any>) {
    const items = await this.prisma.inventory.findMany({
      where: filters.branchId ? { branchId: filters.branchId } : {},
      include: { branch: true, component: true },
    });
    return { csv: `Generated ${items.length} inventory records`, total: items.length };
  }

  private async generateLowStockReport(filters: Record<string, any>) {
    const items = await this.prisma.inventory.findMany({
      where: filters.branchId ? { branchId: filters.branchId } : {},
      include: { branch: true, component: true },
    });
    const lowStock = items.filter((i) => i.quantity <= i.minStockThreshold);
    return { csv: `Generated ${lowStock.length} low-stock records`, total: lowStock.length };
  }
}
