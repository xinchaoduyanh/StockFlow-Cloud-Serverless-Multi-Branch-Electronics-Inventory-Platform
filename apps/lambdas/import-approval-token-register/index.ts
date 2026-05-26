import { PrismaClient, ImportStatus } from "@prisma/client";

const prisma = new PrismaClient();

const handler = async (event: any) => {
  console.log("Approval token register event received:", JSON.stringify(event));

  const { importJobId, taskToken } = event;

  if (!importJobId || !taskToken) {
    console.error("Missing required importJobId or taskToken payload.");
    return { success: false, error: "Missing required parameters" };
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

    console.log(`Task token successfully registered for Job ${importJobId}`);

    return {
      success: true,
      importJobId,
    };
  } catch (err: any) {
    console.error("Failed to register task token:", err);
    return {
      success: false,
      error: err.message,
    };
  } finally {
    await prisma.$disconnect();
  }
};

module.exports = { handler };
