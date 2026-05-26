import {
  ImportPipelineAction,
  StockMovementReferenceType,
  ImportListQuery,
  ImportRowInput,
  importRowInputSchema,
  InitImportBody,
  StartImportBody,
  PresignedPostRequest,
} from "@stockflow/shared";
import { createHash } from "node:crypto";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { ImportRowStatus, ImportStatus, Prisma, StockMovementType } from "@prisma/client";
import ExcelJS from "exceljs";
import { ApiErrors } from "../common/errors/api-error";
import { toPagination } from "../common/schemas/pagination.schema";
import { PrismaService } from "../database/prisma.service";
import { S3Service } from "./s3.service";

type PreparedImportRow = {
  rowNumber: number;
  sku: string;
  rawData: Prisma.InputJsonValue;
  normalizedData?: Prisma.InputJsonValue;
  validationStatus: ImportRowStatus;
  errorMessage?: string;
};

@Injectable()
export class ImportsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  onModuleInit() {
    this.runPollingLoop();
  }

  private async runPollingLoop() {
    let nextDelay = 10000;

    try {
      // 1. Check if there are any jobs currently in-progress
      const activeJobsCount = await this.prisma.importJob.count({
        where: {
          status: {
            in: [ImportStatus.UPLOADED, ImportStatus.VALIDATING, ImportStatus.PREVIEW_READY],
          },
        },
      });

      if (activeJobsCount > 0) {
        // Active job in progress! Poll fast (1 second) to auto-approve instantly
        await this.autoApprovePendingJobs();
        nextDelay = 1000;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Auto-Approve] Polling loop error:", msg);
    } finally {
      // Schedule the next execution recursively
      setTimeout(() => {
        this.runPollingLoop();
      }, nextDelay);
    }
  }

  private async autoApprovePendingJobs() {
    const pendingJobs = await this.prisma.importJob.findMany({
      where: {
        status: ImportStatus.PREVIEW_READY,
        awsTaskToken: { not: null },
      },
    });

    for (const job of pendingJobs) {
      console.log(`[Auto-Approve] Triggering auto-confirm for Job ${job.id}`);
      await this.confirm(job.id).catch(async (err) => {
        console.error(`[Auto-Approve] Failed to auto-confirm Job ${job.id}:`, err.message);

        // If the task token is expired, invalid or the execution is already terminated, clear the token so we don't loop endlessly
        const msg = (err.message || "").toLowerCase();
        if (
          msg.includes("does not exist") ||
          msg.includes("invalid token") ||
          msg.includes("timed out") ||
          err.name === "TaskDoesNotExist" ||
          err.name === "InvalidToken"
        ) {
          console.log(`[Auto-Approve] Clearing invalid/expired token for Job ${job.id}`);
          await this.prisma.importJob.update({
            where: { id: job.id },
            data: { awsTaskToken: null },
          });
        }
      });
    }
  }

  async getPresignedPost(input: PresignedPostRequest, actorId?: string) {
    const job = await this.prisma.importJob.create({
      data: {
        branchId: input.branchId,
        fileName: input.fileName,
        status: ImportStatus.UPLOADED,
        totalRows: 0,
        processedRows: 0,
        validRows: 0,
        invalidRows: 0,
        createdBy: actorId,
      },
    });

    let sanitizedEmail = "unknown-user";
    if (actorId) {
      const user = await this.prisma.user.findUnique({ where: { id: actorId } });
      if (user?.email) {
        sanitizedEmail = user.email.replace("@", ".");
      }
    }

    const s3Key = `imports/${input.branchId}/${sanitizedEmail}/${job.id}-${input.fileName}`;

    await this.prisma.importJob.update({
      where: { id: job.id },
      data: { s3Key },
    });

    const presignedPost = await this.s3Service.generatePresignedPost(s3Key, input.contentType);

    return {
      importJobId: job.id,
      presignedPost,
    };
  }

  async init(input: InitImportBody, actorId?: string) {
    const preparedRows = this.prepareRows(input.rows ?? []);
    const job = await this.prisma.importJob.create({
      data: {
        branchId: input.branchId,
        fileName: input.fileName,
        s3Key: input.s3Key,
        status: preparedRows.length ? ImportStatus.PREVIEW_READY : ImportStatus.UPLOADED,
        totalRows: preparedRows.length,
        processedRows: preparedRows.length,
        validRows: preparedRows.filter((row) => row.validationStatus === ImportRowStatus.VALID)
          .length,
        invalidRows: preparedRows.filter((row) => row.validationStatus === ImportRowStatus.INVALID)
          .length,
        createdBy: actorId,
      },
    });

    if (preparedRows.length) {
      await this.saveRows(job.id, preparedRows);
    }

    return this.get(job.id);
  }

  async upload(branchId: string, file: Express.Multer.File | undefined, actorId?: string) {
    if (!file) {
      throw ApiErrors.badRequest("Excel file is required");
    }

    if (!file.originalname.match(/\.xlsx$/i)) {
      throw ApiErrors.badRequest("Only .xlsx files are supported for Phase 1 upload");
    }

    const rows = await this.parseExcel(file.buffer);
    const preparedRows = this.prepareRows(rows);
    const validRows = preparedRows.filter(
      (row) => row.validationStatus === ImportRowStatus.VALID,
    ).length;
    const invalidRows = preparedRows.length - validRows;

    const job = await this.prisma.importJob.create({
      data: {
        branchId,
        fileName: file.originalname,
        status: ImportStatus.PREVIEW_READY,
        totalRows: preparedRows.length,
        processedRows: preparedRows.length,
        validRows,
        invalidRows,
        createdBy: actorId,
      },
    });

    if (preparedRows.length) {
      await this.saveRows(job.id, preparedRows);
    }

    return this.get(job.id);
  }

  list(query: ImportListQuery) {
    const { skip, take } = toPagination(query);

    return this.prisma.importJob.findMany({
      skip,
      take,
      where: query.branchId ? { branchId: query.branchId } : {},
      include: { branch: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async get(id: string) {
    const job = await this.prisma.importJob.findUnique({
      where: { id },
      include: { branch: true, rows: { orderBy: { rowNumber: "asc" } } },
    });

    if (!job) {
      throw ApiErrors.notFound("Import job not found");
    }

    return job;
  }

  async start(id: string, input: StartImportBody) {
    await this.assertJob(id);
    const preparedRows = this.prepareRows(input.rows);
    const validRows = preparedRows.filter(
      (row) => row.validationStatus === ImportRowStatus.VALID,
    ).length;

    await this.prisma.$transaction(async (tx) => {
      await tx.importJobRow.deleteMany({ where: { importJobId: id } });
      await tx.importJob.update({
        where: { id },
        data: {
          status: ImportStatus.PREVIEW_READY,
          totalRows: preparedRows.length,
          processedRows: preparedRows.length,
          validRows,
          invalidRows: preparedRows.length - validRows,
        },
      });
    });

    await this.saveRows(id, preparedRows);
    return this.get(id);
  }

  async progress(id: string) {
    const job = await this.assertJob(id);
    return {
      id: job.id,
      status: job.status,
      totalRows: job.totalRows,
      processedRows: job.processedRows,
      validRows: job.validRows,
      invalidRows: job.invalidRows,
      committedRows: job.committedRows,
    };
  }

  errors(id: string) {
    return this.prisma.importJobRow.findMany({
      where: {
        importJobId: id,
        validationStatus: ImportRowStatus.INVALID,
      },
      orderBy: { rowNumber: "asc" },
    });
  }

  preview(id: string) {
    return this.prisma.importJobRow.findMany({
      where: { importJobId: id },
      orderBy: { rowNumber: "asc" },
    });
  }

  async confirm(id: string, actorId?: string) {
    const job = await this.assertJob(id);

    if (job.status !== ImportStatus.PREVIEW_READY) {
      throw ApiErrors.badRequest("Import job is not ready to confirm");
    }

    if (job.awsTaskToken) {
      const { SFNClient, SendTaskSuccessCommand } = await import("@aws-sdk/client-sfn");
      const sfnClient = new SFNClient({});

      try {
        await sfnClient.send(
          new SendTaskSuccessCommand({
            taskToken: job.awsTaskToken,
            output: JSON.stringify({
              importJobId: id,
              action: ImportPipelineAction.CONFIRM,
            }),
          }),
        );

        return this.prisma.importJob.update({
          where: { id },
          data: {
            status: ImportStatus.COMMITTING,
            awsTaskToken: null,
          },
          include: { branch: true, rows: { orderBy: { rowNumber: "asc" } } },
        });
      } catch (err: any) {
        throw ApiErrors.badRequest(
          `Failed to resume serverless ingestion pipeline: ${err.message}`,
        );
      }
    }

    const rows = await this.prisma.importJobRow.findMany({
      where: {
        importJobId: id,
        validationStatus: ImportRowStatus.VALID,
      },
      orderBy: { rowNumber: "asc" },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      let committedRows = 0;

      for (const row of rows) {
        const data = row.normalizedData as ImportRowInput;
        const component = await tx.component.upsert({
          where: { sku: data.sku },
          update: {
            name: data.name,
            brand: data.brand,
            category: data.category,
            specs: this.toSpecs(data) as Prisma.InputJsonValue,
            unitPrice: data.unitPrice,
            supplier: data.supplier,
            warrantyMonths: data.warrantyMonths,
          },
          create: {
            sku: data.sku,
            name: data.name,
            brand: data.brand,
            category: data.category,
            specs: this.toSpecs(data) as Prisma.InputJsonValue,
            unitPrice: data.unitPrice,
            supplier: data.supplier,
            warrantyMonths: data.warrantyMonths,
          },
        });

        await tx.inventory.upsert({
          where: {
            branchId_componentId: {
              branchId: job.branchId,
              componentId: component.id,
            },
          },
          update: {
            quantity: { increment: data.quantity },
            version: { increment: 1 },
          },
          create: {
            branchId: job.branchId,
            componentId: component.id,
            quantity: data.quantity,
          },
        });

        await tx.stockMovement.create({
          data: {
            branchId: job.branchId,
            componentId: component.id,
            movementType: StockMovementType.IMPORT_IN,
            quantityChange: data.quantity,
            referenceType: StockMovementReferenceType.IMPORT_JOB,
            referenceId: job.id,
            createdBy: actorId,
          },
        });

        await tx.importJobRow.update({
          where: { id: row.id },
          data: {
            validationStatus: ImportRowStatus.COMMITTED,
            processedAt: new Date(),
          },
        });

        committedRows += 1;
      }

      return tx.importJob.update({
        where: { id },
        data: {
          status: ImportStatus.COMPLETED,
          committedRows,
          completedAt: new Date(),
        },
      });
    });

    return result;
  }

  async cancel(id: string) {
    const job = await this.assertJob(id);

    if (job.awsTaskToken) {
      const { SFNClient, SendTaskSuccessCommand } = await import("@aws-sdk/client-sfn");
      const sfnClient = new SFNClient({});

      try {
        await sfnClient.send(
          new SendTaskSuccessCommand({
            taskToken: job.awsTaskToken,
            output: JSON.stringify({
              importJobId: id,
              action: ImportPipelineAction.CANCEL,
            }),
          }),
        );

        return this.prisma.importJob.update({
          where: { id },
          data: {
            status: ImportStatus.CANCELLED,
            awsTaskToken: null,
          },
        });
      } catch (err: any) {
        throw ApiErrors.badRequest(
          `Failed to cancel serverless ingestion pipeline: ${err.message}`,
        );
      }
    }

    return this.prisma.importJob.update({
      where: { id },
      data: { status: ImportStatus.CANCELLED },
    });
  }

  private async saveRows(importJobId: string, rows: PreparedImportRow[]) {
    await this.prisma.importJobRow.createMany({
      data: rows.map((row) => ({
        importJobId,
        rowNumber: row.rowNumber,
        sku: row.sku || undefined,
        rawData: row.rawData,
        normalizedData: row.normalizedData,
        validationStatus: row.validationStatus,
        errorMessage: row.errorMessage,
        idempotencyKey: this.idempotencyKey(importJobId, row.rowNumber, row.sku || "missing-sku"),
      })),
    });
  }

  private async parseExcel(buffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );
    await workbook.xlsx.load(arrayBuffer as never);
    const sheet = workbook.worksheets[0];

    if (!sheet) {
      throw ApiErrors.badRequest("Excel workbook does not contain any sheets");
    }

    const headers: string[] = [];
    const rows: Record<string, unknown>[] = [];

    sheet.eachRow((row, rowNumber) => {
      const values = row.values;

      if (!Array.isArray(values)) {
        return;
      }

      if (rowNumber === 1) {
        values.slice(1).forEach((value) => headers.push(this.toStringValue(this.cellValue(value))));
        return;
      }

      const item: Record<string, unknown> = {};
      values.slice(1).forEach((value, index) => {
        const header = headers[index];

        if (header) {
          item[header] = this.cellValue(value);
        }
      });
      rows.push(item);
    });

    return rows.map((row) => this.normalizeExcelRow(row));
  }

  private normalizeExcelRow(row: Record<string, unknown>) {
    const normalized = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [this.normalizeHeader(key), value]),
    );

    return {
      sku: this.toStringValue(normalized.sku),
      name: this.toStringValue(normalized.name),
      brand: this.toOptionalString(normalized.brand),
      category: this.toStringValue(normalized.category).toUpperCase(),
      quantity: this.toNumber(normalized.quantity),
      unitPrice: this.toOptionalNumber(normalized.unitprice),
      supplier: this.toOptionalString(normalized.supplier),
      warrantyMonths: this.toOptionalNumber(normalized.warrantymonths),
      ddrGeneration: this.toOptionalString(normalized.ddrgeneration)?.toUpperCase(),
      speedMhz: this.toOptionalNumber(normalized.speedmhz),
      capacityGb: this.toOptionalNumber(normalized.capacitygb),
      socket: this.toOptionalString(normalized.socket),
      cores: this.toOptionalNumber(normalized.cores),
      threads: this.toOptionalNumber(normalized.threads),
      interface: this.toInterface(normalized.interface),
      formFactor: this.toOptionalString(normalized.formfactor),
      vramGb: this.toOptionalNumber(normalized.vramgb),
      chipset: this.toOptionalString(normalized.chipset),
    };
  }

  private prepareRows(rows: unknown[]): PreparedImportRow[] {
    const seen = new Set<string>();

    return rows.map((row, index) => {
      const result = importRowInputSchema.safeParse(row);
      const sku = typeof row === "object" && row && "sku" in row ? String(row.sku ?? "") : "";

      if (!result.success) {
        return {
          rowNumber: index + 1,
          sku,
          rawData: this.toJson(row),
          validationStatus: ImportRowStatus.INVALID,
          errorMessage: result.error.issues
            .map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`)
            .join("; "),
        };
      }

      const duplicate = seen.has(result.data.sku);
      seen.add(result.data.sku);

      return {
        rowNumber: index + 1,
        sku: result.data.sku,
        rawData: this.toJson(row),
        normalizedData: this.toJson(result.data),
        validationStatus: duplicate ? ImportRowStatus.INVALID : ImportRowStatus.VALID,
        errorMessage: duplicate ? "sku must be unique within file" : undefined,
      };
    });
  }

  private normalizeHeader(header: string) {
    return header
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "");
  }

  private toStringValue(value: unknown) {
    return String(value ?? "").trim();
  }

  private toOptionalString(value: unknown) {
    const text = this.toStringValue(value);
    return text ? text : undefined;
  }

  private toNumber(value: unknown) {
    return Number(value);
  }

  private toOptionalNumber(value: unknown) {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    return Number(value);
  }

  private toInterface(value: unknown) {
    const text = this.toOptionalString(value)?.toUpperCase();

    if (text === "NVME") {
      return "NVMe";
    }

    return text;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private cellValue(value: ExcelJS.CellValue) {
    if (value && typeof value === "object") {
      if ("text" in value) {
        return value.text;
      }

      if ("result" in value) {
        return value.result;
      }

      if ("richText" in value) {
        return value.richText.map((part) => part.text).join("");
      }
    }

    return value ?? "";
  }

  private async assertJob(id: string) {
    const job = await this.prisma.importJob.findUnique({ where: { id } });

    if (!job) {
      throw ApiErrors.notFound("Import job not found");
    }

    return job;
  }

  private idempotencyKey(importJobId: string, rowNumber: number, sku: string) {
    return createHash("sha256").update(`${importJobId}:${rowNumber}:${sku}`).digest("hex");
  }

  private toSpecs(row: ImportRowInput) {
    return {
      ddrGeneration: row.ddrGeneration,
      speedMhz: row.speedMhz,
      capacityGb: row.capacityGb,
      socket: row.socket,
      cores: row.cores,
      threads: row.threads,
      interface: row.interface,
      formFactor: row.formFactor,
      vramGb: row.vramGb,
      chipset: row.chipset,
    };
  }
}
