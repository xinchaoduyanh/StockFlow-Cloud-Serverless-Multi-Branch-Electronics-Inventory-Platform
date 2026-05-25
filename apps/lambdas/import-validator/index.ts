import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { PrismaClient, ImportStatus } from "@prisma/client";
import * as ExcelJS from "exceljs";

const s3Client = new S3Client({});
const prisma = new PrismaClient();

export const handler = async (event: any) => {
  console.log("Validator event received:", JSON.stringify(event));

  let bucket = "";
  let key = "";
  let size = 0;

  if (event.Records && event.Records.length > 0) {
    const record = event.Records[0];
    bucket = record.s3.bucket.name;
    key = record.s3.object.key;
    size = record.s3.object.size;
  } else {
    bucket = event.bucket || "";
    key = event.key || "";
    size = event.size || 0;
  }

  if (!key) {
    console.error("S3 object key is empty.");
    return { isValid: false, error: "S3 object key is empty" };
  }

  if (!key.endsWith(".xlsx")) {
    console.error("Invalid file format. Only .xlsx files are supported.");
    return { isValid: false, error: "Only .xlsx files are supported" };
  }

  const keyParts = key.split("/");
  if (keyParts.length < 3) {
    console.error("Invalid S3 key structure:", key);
    return { isValid: false, error: "Invalid S3 key structure" };
  }

  const filePart = keyParts[keyParts.length - 1];
  const jobId = filePart.slice(0, 36);

  try {
    const job = await prisma.importJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      console.error(`Import job ${jobId} not found in database.`);
      return { isValid: false, error: "Import job not found" };
    }

    if (size > 20971520) {
      const errMsg = "File exceeds maximum size limit of 20MB.";
      console.error(errMsg);
      await prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: ImportStatus.FAILED,
          errorMessage: errMsg,
        },
      });
      return { isValid: false, importJobId: jobId, error: errMsg };
    }

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
    for await (const worksheetReader of workbookReader) {
      for await (const row of worksheetReader) {
        const values = Array.isArray(row.values) ? row.values : Object.values(row.values);
        headers = values
          .filter((v: any) => typeof v === "string" || typeof v === "number")
          .map((v: any) => String(v).trim().toLowerCase());
        break;
      }
      break;
    }

    const requiredHeaders = ["sku", "name", "category", "quantity"];
    const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));

    if (missingHeaders.length > 0) {
      const errMsg = `Missing required columns: ${missingHeaders.join(", ")}`;
      console.error(errMsg);
      await prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: ImportStatus.FAILED,
          errorMessage: errMsg,
        },
      });
      return { isValid: false, importJobId: jobId, error: errMsg };
    }

    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: ImportStatus.VALIDATING,
      },
    });

    return {
      isValid: true,
      importJobId: jobId,
      bucket,
      key,
    };
  } catch (err: any) {
    console.error("Validation exception:", err);
    return {
      isValid: false,
      error: err.message,
    };
  } finally {
    await prisma.$disconnect();
  }
};
