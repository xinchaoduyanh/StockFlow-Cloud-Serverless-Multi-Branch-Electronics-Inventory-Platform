import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ImportRowStatus, ImportStatus, Prisma, StockMovementType } from "@prisma/client";
import { ApiErrors } from "../common/errors/api-error";
import { toPagination } from "../common/schemas/pagination.schema";
import { PrismaService } from "../database/prisma.service";
import { ImportListQuery, ImportRowInput, InitImportBody, StartImportBody } from "./imports.schemas";

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}

  async init(input: InitImportBody, actorId?: string) {
    const job = await this.prisma.importJob.create({
      data: {
        branchId: input.branchId,
        fileName: input.fileName,
        s3Key: input.s3Key,
        status: input.rows?.length ? ImportStatus.PREVIEW_READY : ImportStatus.UPLOADED,
        totalRows: input.rows?.length ?? 0,
        processedRows: input.rows?.length ?? 0,
        validRows: input.rows?.length ?? 0,
        createdBy: actorId,
      },
    });

    if (input.rows?.length) {
      await this.saveRows(job.id, input.rows);
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

    await this.prisma.$transaction(async (tx) => {
      await tx.importJobRow.deleteMany({ where: { importJobId: id } });
      await tx.importJob.update({
        where: { id },
        data: {
          status: ImportStatus.PREVIEW_READY,
          totalRows: input.rows.length,
          processedRows: input.rows.length,
          validRows: input.rows.length,
          invalidRows: 0,
        },
      });
    });

    await this.saveRows(id, input.rows);
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
            referenceType: "IMPORT_JOB",
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
    await this.assertJob(id);
    return this.prisma.importJob.update({
      where: { id },
      data: { status: ImportStatus.CANCELLED },
    });
  }

  private async saveRows(importJobId: string, rows: ImportRowInput[]) {
    const seen = new Set<string>();

    await this.prisma.importJobRow.createMany({
      data: rows.map((row, index) => {
        const duplicate = seen.has(row.sku);
        seen.add(row.sku);

        return {
          importJobId,
          rowNumber: index + 1,
          sku: row.sku,
          rawData: row as Prisma.InputJsonValue,
          normalizedData: row as Prisma.InputJsonValue,
          validationStatus: duplicate ? ImportRowStatus.INVALID : ImportRowStatus.VALID,
          errorMessage: duplicate ? "sku must be unique within file" : undefined,
          idempotencyKey: this.idempotencyKey(importJobId, index + 1, row.sku),
        };
      }),
    });
  }

  private async assertJob(id: string) {
    const job = await this.prisma.importJob.findUnique({ where: { id } });

    if (!job) {
      throw ApiErrors.notFound("Import job not found");
    }

    return job;
  }

  private idempotencyKey(importJobId: string, rowNumber: number, sku: string) {
    return createHash("sha256")
      .update(`${importJobId}:${rowNumber}:${sku}`)
      .digest("hex");
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
