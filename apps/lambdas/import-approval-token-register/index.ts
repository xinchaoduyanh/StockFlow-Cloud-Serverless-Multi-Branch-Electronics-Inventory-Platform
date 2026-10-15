import { withDatabaseUrl } from "@stockflow/shared/dist/database-url";
import { createLogger, withObservability } from "@stockflow/shared/dist/logger";
import { PrismaClient, ImportStatus } from "@prisma/client";

const logger = createLogger("import-approval-token-register");

// Tạo trong withDatabaseUrl, sau khi SSM trả về DATABASE_URL (xem ensureDatabaseUrl).
let prisma: PrismaClient;

const handler = async (event: any) => {
  const { importJobId, taskToken } = event;

  if (!importJobId || !taskToken) {
    logger.error("Missing required importJobId or taskToken payload.");
    throw new Error("Missing required parameters");
  }

  try {
    // Save SFN taskToken directly to database record
    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        awsTaskToken: taskToken,
        status: ImportStatus.PREVIEW_READY, // Ensure status transitions to PREVIEW_READY
      },
    });

    logger.info(`Task token successfully registered for Job ${importJobId}`);

    return {
      success: true,
      importJobId,
    };
  } catch (err: any) {
    logger.error("Failed to register task token", err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
};

module.exports = {
  handler: withObservability(
    logger,
    withDatabaseUrl(handler, () => {
      prisma ??= new PrismaClient();
    }),
  ),
};
