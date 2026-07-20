import { reportJobMessageSchema, ReportType as ExternalReportType } from "@stockflow/shared";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { PrismaClient, ExportJobStatus, ReportType as PrismaReportType } from "@prisma/client";
import type { SQSHandler } from "aws-lambda";

const s3Client = new S3Client({});
const prisma = new PrismaClient();

const externalReportTypeByPrisma: Record<PrismaReportType, ExternalReportType> = {
  [PrismaReportType.INVENTORY]: ExternalReportType.INVENTORY,
  [PrismaReportType.LOW_STOCK]: ExternalReportType.LOW_STOCK,
  [PrismaReportType.TRANSFERS]: ExternalReportType.TRANSFERS,
  [PrismaReportType.IMPORT_HISTORY]: ExternalReportType.IMPORT_HISTORY,
  [PrismaReportType.STOCK_MOVEMENTS]: ExternalReportType.STOCK_MOVEMENTS,
};

/**
 * Report Exporter Lambda
 *
 * Generates CSV reports from inventory/transfer data and uploads to S3.
 * Supports report types: inventory, low-stock, transfers, import-history, stock-movements
 *
 * Input event: SQS batch containing { version, exportJobId } messages.
 */
async function processReport(exportJobId: string, receiveCount: number): Promise<void> {
  const claimStartedAt = new Date();
  const leaseSeconds = Number(process.env.REPORT_PROCESSING_LEASE_SECONDS || "900");
  const staleBefore = new Date(claimStartedAt.getTime() - leaseSeconds * 1000);

  try {
    const claim = await prisma.exportJob.updateMany({
      where: {
        id: exportJobId,
        OR: [
          { status: ExportJobStatus.PENDING },
          { status: ExportJobStatus.PROCESSING, processingStartedAt: { lt: staleBefore } },
        ],
      },
      data: {
        status: ExportJobStatus.PROCESSING,
        processingStartedAt: claimStartedAt,
        attemptCount: { increment: 1 },
      },
    });

    if (claim.count !== 1) {
      const current = await prisma.exportJob.findUnique({ where: { id: exportJobId } });
      if (!current) throw new Error("Export job not found");
      if (
        current.status === ExportJobStatus.COMPLETED ||
        current.status === ExportJobStatus.DISCARDED
      ) {
        return;
      }
      // Another worker owns an active processing lease. The message is safe to
      // acknowledge because the owning worker is responsible for completion.
      return;
    }

    const job = await prisma.exportJob.findUnique({ where: { id: exportJobId } });
    if (!job) throw new Error("Export job not found");

    const filters = (job.filters as Record<string, any>) || {};
    let csvContent: string;
    let totalRecords: number;

    // 2. Generate CSV based on report type
    switch (job.reportType) {
      case PrismaReportType.INVENTORY:
        ({ csv: csvContent, total: totalRecords } = await generateInventoryReport(filters));
        break;
      case PrismaReportType.LOW_STOCK:
        ({ csv: csvContent, total: totalRecords } = await generateLowStockReport(filters));
        break;
      case PrismaReportType.TRANSFERS:
        ({ csv: csvContent, total: totalRecords } = await generateTransferReport(filters));
        break;
      case PrismaReportType.IMPORT_HISTORY:
        ({ csv: csvContent, total: totalRecords } = await generateImportHistoryReport(filters));
        break;
      case PrismaReportType.STOCK_MOVEMENTS:
        ({ csv: csvContent, total: totalRecords } = await generateStockMovementReport(filters));
        break;
      default:
        throw new Error(`Unsupported report type: ${job.reportType}`);
    }

    // 3. Upload CSV to S3
    const bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || "";
    const externalReportType = externalReportTypeByPrisma[job.reportType];
    const s3Key = `reports/${externalReportType}/${exportJobId}.csv`;
    const fileName = `${externalReportType}-${exportJobId}.csv`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: csvContent,
        ContentType: "text/csv",
        ContentDisposition: `attachment; filename="${fileName}"`,
      }),
    );

    console.log(`Report uploaded to s3://${bucket}/${s3Key}. Total records: ${totalRecords}`);

    // 4. Finalize only the current processing claim.
    const finalized = await prisma.exportJob.updateMany({
      where: {
        id: exportJobId,
        status: ExportJobStatus.PROCESSING,
        processingStartedAt: claimStartedAt,
      },
      data: {
        status: ExportJobStatus.COMPLETED,
        s3Key,
        fileName,
        totalRecords,
        completedAt: new Date(),
      },
    });
    if (finalized.count !== 1) {
      throw new Error("Report claim expired before completion");
    }
  } catch (error) {
    const maxReceiveCount = Number(process.env.REPORT_MAX_RECEIVE_COUNT || "5");
    const exhausted = receiveCount >= maxReceiveCount;
    await prisma.exportJob.updateMany({
      where: {
        id: exportJobId,
        status: ExportJobStatus.PROCESSING,
        processingStartedAt: claimStartedAt,
      },
      data: {
        status: exhausted ? ExportJobStatus.FAILED : ExportJobStatus.PENDING,
        lastErrorCode: "REPORT_EXPORT_FAILED",
        errorMessage: exhausted
          ? "Report export failed after the configured retry limit."
          : "Report export failed and will be retried.",
        processingStartedAt: null,
      },
    });
    throw error;
  }
}

export const handler: SQSHandler = async (event) => {
  const batchItemFailures: Array<{ itemIdentifier: string }> = [];

  for (const record of event.Records) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(record.body);
    } catch {
      batchItemFailures.push({ itemIdentifier: record.messageId });
      continue;
    }

    const message = reportJobMessageSchema.safeParse(parsed);
    if (!message.success) {
      batchItemFailures.push({ itemIdentifier: record.messageId });
      continue;
    }

    try {
      await processReport(
        message.data.exportJobId,
        Number(record.attributes.ApproximateReceiveCount || "1"),
      );
    } catch (error) {
      console.error("Report export failed", {
        messageId: record.messageId,
        exportJobId: message.data.exportJobId,
        errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
      });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};

// ---------------------------------------------------------------------------
// Report Generators
// ---------------------------------------------------------------------------

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const headerLine = headers.map(escapeCsv).join(",");
  const dataLines = rows.map((row) => headers.map((h) => escapeCsv(row[h])).join(","));
  return [headerLine, ...dataLines].join("\n");
}

async function generateInventoryReport(filters: Record<string, any>) {
  const items = await prisma.inventory.findMany({
    where: {
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
    },
    include: {
      branch: true,
      component: true,
    },
    orderBy: [{ branch: { code: "asc" } }, { component: { sku: "asc" } }],
  });

  const headers = [
    "branchCode",
    "branchName",
    "sku",
    "componentName",
    "brand",
    "category",
    "quantity",
    "reservedQuantity",
    "availableQuantity",
    "minStockThreshold",
    "unitPrice",
    "supplier",
    "warrantyMonths",
  ];

  const rows = items.map((item) => ({
    branchCode: item.branch.code,
    branchName: item.branch.name,
    sku: item.component.sku,
    componentName: item.component.name,
    brand: item.component.brand,
    category: item.component.category,
    quantity: item.quantity,
    reservedQuantity: item.reservedQuantity,
    availableQuantity: item.quantity - item.reservedQuantity,
    minStockThreshold: item.minStockThreshold,
    unitPrice: item.component.unitPrice,
    supplier: item.component.supplier,
    warrantyMonths: item.component.warrantyMonths,
  }));

  return { csv: toCsv(headers, rows), total: rows.length };
}

async function generateLowStockReport(filters: Record<string, any>) {
  const items = await prisma.inventory.findMany({
    where: {
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
    },
    include: {
      branch: true,
      component: true,
    },
    orderBy: [{ branch: { code: "asc" } }, { component: { sku: "asc" } }],
  });

  const lowStockItems = items.filter((item) => item.quantity <= item.minStockThreshold);

  const headers = [
    "branchCode",
    "branchName",
    "sku",
    "componentName",
    "category",
    "quantity",
    "minStockThreshold",
    "deficit",
  ];

  const rows = lowStockItems.map((item) => ({
    branchCode: item.branch.code,
    branchName: item.branch.name,
    sku: item.component.sku,
    componentName: item.component.name,
    category: item.component.category,
    quantity: item.quantity,
    minStockThreshold: item.minStockThreshold,
    deficit: item.minStockThreshold - item.quantity,
  }));

  return { csv: toCsv(headers, rows), total: rows.length };
}

async function generateTransferReport(filters: Record<string, any>) {
  const transfers = await prisma.transfer.findMany({
    where: {
      ...(filters.branchId
        ? { OR: [{ fromBranchId: filters.branchId }, { toBranchId: filters.branchId }] }
        : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: {
      fromBranch: true,
      toBranch: true,
      items: { include: { component: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "transferId",
    "fromBranch",
    "toBranch",
    "status",
    "sku",
    "componentName",
    "quantity",
    "createdAt",
    "completedAt",
  ];

  const rows: Record<string, unknown>[] = [];
  for (const transfer of transfers) {
    for (const item of transfer.items) {
      rows.push({
        transferId: transfer.id,
        fromBranch: transfer.fromBranch.code,
        toBranch: transfer.toBranch.code,
        status: transfer.status,
        sku: item.component.sku,
        componentName: item.component.name,
        quantity: item.quantity,
        createdAt: transfer.createdAt.toISOString(),
        completedAt: transfer.completedAt?.toISOString() || "",
      });
    }
  }

  return { csv: toCsv(headers, rows), total: rows.length };
}

async function generateImportHistoryReport(filters: Record<string, any>) {
  const jobs = await prisma.importJob.findMany({
    where: {
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
    },
    include: { branch: true },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "jobId",
    "branchCode",
    "branchName",
    "fileName",
    "status",
    "totalRows",
    "validRows",
    "invalidRows",
    "committedRows",
    "createdAt",
    "completedAt",
  ];

  const rows = jobs.map((job) => ({
    jobId: job.id,
    branchCode: job.branch.code,
    branchName: job.branch.name,
    fileName: job.fileName,
    status: job.status,
    totalRows: job.totalRows,
    validRows: job.validRows,
    invalidRows: job.invalidRows,
    committedRows: job.committedRows,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt?.toISOString() || "",
  }));

  return { csv: toCsv(headers, rows), total: rows.length };
}

async function generateStockMovementReport(filters: Record<string, any>) {
  const movements = await prisma.stockMovement.findMany({
    where: {
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(filters.movementType ? { movementType: filters.movementType } : {}),
    },
    include: {
      branch: true,
      component: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10000, // Safety limit
  });

  const headers = [
    "branchCode",
    "branchName",
    "sku",
    "componentName",
    "movementType",
    "quantityChange",
    "referenceType",
    "referenceId",
    "createdAt",
  ];

  const rows = movements.map((m) => ({
    branchCode: m.branch.code,
    branchName: m.branch.name,
    sku: m.component.sku,
    componentName: m.component.name,
    movementType: m.movementType,
    quantityChange: m.quantityChange,
    referenceType: m.referenceType,
    referenceId: m.referenceId,
    createdAt: m.createdAt.toISOString(),
  }));

  return { csv: toCsv(headers, rows), total: rows.length };
}
