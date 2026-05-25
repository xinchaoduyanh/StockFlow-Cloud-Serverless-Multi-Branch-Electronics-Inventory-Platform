import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { PrismaClient, ImportStatus, ImportRowStatus, Prisma } from "@prisma/client";
import * as ExcelJS from "exceljs";
import { importRowInputSchema } from "../../api/src/imports/imports.schemas";

const s3Client = new S3Client({});
const prisma = new PrismaClient();

export const handler = async (event: any) => {
  console.log("Parser event received:", JSON.stringify(event));

  const { importJobId, bucket, key } = event;

  if (!importJobId || !bucket || !key) {
    console.error("Missing required S3 or job identification parameters.");
    return { status: "FAILED", error: "Missing required parameters" };
  }

  try {
    // 1. Update status to PARSING
    await prisma.importJob.update({
      where: { id: importJobId },
      data: { status: ImportStatus.PARSING },
    });

    // 2. Fetch S3 spreadsheet stream
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    const inputStream = response.Body as NodeJS.ReadableStream;
    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(inputStream, {
      entries: "emit",
      sharedStrings: "cache",
      styles: "ignore",
      hyperlinks: "ignore",
      worksheets: "emit",
    });

    let headers: string[] = [];
    let totalRows = 0;
    let validRows = 0;
    let invalidRows = 0;
    const rowsStaging: any[] = [];
    const CHUNK_SIZE = 500;

    for await (const worksheetReader of workbookReader) {
      for await (const row of worksheetReader) {
        const rawValues = Array.isArray(row.values) ? row.values : Object.values(row.values);
        
        // Remove ExcelJS 1-based offset empty item if present
        if (Array.isArray(row.values) && rawValues[0] === undefined) {
          rawValues.shift();
        }

        const cleanValues = rawValues.map((v: any) => {
          if (v && typeof v === "object" && "richText" in v) {
            return v.richText.map((rt: any) => rt.text).join("");
          }
          return v;
        });

        // Skip completely empty lines
        if (cleanValues.every((v: any) => v === null || v === undefined || String(v).trim() === "")) {
          continue;
        }

        if (headers.length === 0) {
          headers = cleanValues.map((v: any) => String(v ?? "").trim().toLowerCase());
          continue;
        }

        totalRows++;

        // Map row cells to keys
        const rowData: Record<string, any> = {};
        headers.forEach((header, index) => {
          if (header) {
            rowData[header] = cleanValues[index] !== undefined ? cleanValues[index] : null;
          }
        });

        const sku = String(rowData.sku ?? "").trim();

        // 3. Normalize values types for Zod validation
        const normalizedInput: Record<string, any> = {
          sku: rowData.sku ? String(rowData.sku).trim() : undefined,
          name: rowData.name ? String(rowData.name).trim() : undefined,
          brand: rowData.brand ? String(rowData.brand).trim() : undefined,
          category: rowData.category ? String(rowData.category).toUpperCase().trim() : undefined,
          supplier: rowData.supplier ? String(rowData.supplier).trim() : undefined,
          ddrGeneration: rowData.ddrgeneration ? String(rowData.ddrgeneration).toUpperCase().trim() : undefined,
          interface: rowData.interface ? String(rowData.interface).trim() : undefined,
          formFactor: rowData.formfactor ? String(rowData.formfactor).trim() : undefined,
          chipset: rowData.chipset ? String(rowData.chipset).trim() : undefined,
          socket: rowData.socket ? String(rowData.socket).trim() : undefined,
          efficiencyRating: rowData.efficiencyrating ? String(rowData.efficiencyrating).trim() : undefined,
          modular: rowData.modular !== undefined && rowData.modular !== null ? String(rowData.modular).trim() : undefined,
          caseSize: rowData.casesize ? String(rowData.casesize).trim() : undefined,
          supportedMainboard: rowData.supportedmainboard ? String(rowData.supportedmainboard).trim() : undefined,
          coolerType: rowData.coolertype ? String(rowData.coolertype).trim() : undefined,
          supportedSocket: rowData.supportedsocket ? String(rowData.supportedsocket).trim() : undefined,
        };

        const numericFields = [
          { key: "quantity", dest: "quantity" },
          { key: "unitprice", dest: "unitPrice" },
          { key: "warrantymonths", dest: "warrantyMonths" },
          { key: "speedmhz", dest: "speedMhz" },
          { key: "capacitygb", dest: "capacityGb" },
          { key: "cores", dest: "cores" },
          { key: "threads", dest: "threads" },
          { key: "vramgb", dest: "vramGb" },
          { key: "wattage", dest: "wattage" },
        ];

        numericFields.forEach((field) => {
          if (rowData[field.key] !== undefined && rowData[field.key] !== null && rowData[field.key] !== "") {
            const num = Number(rowData[field.key]);
            normalizedInput[field.dest] = isNaN(num) ? rowData[field.key] : num;
          }
        });

        // 4. Run Zod Validation
        const validationResult = importRowInputSchema.safeParse(normalizedInput);

        let validationStatus: ImportRowStatus;
        let errorMessage: string | null = null;
        let finalNormalizedData: any = null;

        if (validationResult.success) {
          validationStatus = ImportRowStatus.VALID;
          validRows++;
          finalNormalizedData = validationResult.data;
        } else {
          validationStatus = ImportRowStatus.INVALID;
          invalidRows++;
          errorMessage = validationResult.error.issues
            .map((e: any) => `${e.path.join(".")}: ${e.message}`)
            .join(" | ");
        }

        rowsStaging.push({
          importJobId,
          rowNumber: row.number,
          sku,
          validationStatus,
          errorMessage,
          rawData: rowData as Prisma.InputJsonValue,
          normalizedData: finalNormalizedData as Prisma.InputJsonValue,
          idempotencyKey: `${importJobId}-${row.number}`,
        });

        // Chunk insert to staging database
        if (rowsStaging.length >= CHUNK_SIZE) {
          await prisma.importJobRow.createMany({
            data: rowsStaging.slice(),
          });
          rowsStaging.length = 0;
        }
      }
      break; // Only parse the very first sheet
    }

    // Insert residual rows
    if (rowsStaging.length > 0) {
      await prisma.importJobRow.createMany({
        data: rowsStaging,
      });
    }

    // 5. Update job counters and transition status to PREVIEW_READY
    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: ImportStatus.PREVIEW_READY,
        totalRows,
        processedRows: totalRows,
        validRows,
        invalidRows,
      },
    });

    console.log(`Parsing finished. Total: ${totalRows}, Valid: ${validRows}, Invalid: ${invalidRows}`);

    return {
      importJobId,
      status: "PREVIEW_READY",
      totalRows,
      validRows,
      invalidRows,
    };
  } catch (err: any) {
    console.error("Stream parsing failed with exception:", err);
    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: ImportStatus.FAILED,
        errorMessage: `Parsing failed: ${err.message}`,
      },
    });
    return {
      importJobId,
      status: "FAILED",
      error: err.message,
    };
  } finally {
    await prisma.$disconnect();
  }
};
