import { PrismaClient, ImportStatus } from "@prisma/client";

const prisma = new PrismaClient();

export const handler = async (event: any) => {
  console.log("Job failure handler event received:", JSON.stringify(event));

  // Step Functions error objects often contain Error and Cause
  const importJobId = event.importJobId || (event.Payload && event.Payload.importJobId);
  const errorName = event.Error || "UnknownError";
  const errorMessage = event.Cause || event.Message || "State machine execution failure";

  if (!importJobId) {
    console.error("No importJobId found in the failure event payload.");
    return { success: false, error: "No importJobId found" };
  }

  try {
    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: ImportStatus.FAILED,
        errorMessage: `${errorName}: ${errorMessage}`,
      },
    });

    console.log(`Import job ${importJobId} successfully marked as FAILED.`);

    return {
      success: true,
      importJobId,
    };
  } catch (err: any) {
    console.error("Failed to mark job as failed:", err);
    return {
      success: false,
      error: err.message,
    };
  } finally {
    await prisma.$disconnect();
  }
};
