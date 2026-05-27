import { PrismaClient, ImportStatus } from "@prisma/client";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const prisma = new PrismaClient();

const handler = async (event: any) => {
  console.log("Job failure handler event received:", JSON.stringify(event));

  // Step Functions error objects often contain Error and Cause
  let importJobId = event.importJobId || (event.Payload && event.Payload.importJobId);

  // Fallback: Parse importJobId from S3 key if available
  if (!importJobId && event.key) {
    const keyParts = String(event.key).split("/");
    if (keyParts.length >= 3) {
      const filePart = keyParts[keyParts.length - 1];
      importJobId = filePart.slice(0, 36);
    }
  }

  const errorName = event.Error || (event.errorInfo && event.errorInfo.Error) || "UnknownError";
  const errorMessage =
    event.Cause ||
    event.Message ||
    (event.errorInfo && event.errorInfo.Cause) ||
    "State machine execution failure";

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

    // Trigger Failure email and In-app alert notification
    try {
      const updatedJob = await prisma.importJob.findUnique({
        where: { id: importJobId },
        include: { branch: { select: { code: true } } },
      });

      if (updatedJob && updatedJob.createdBy) {
        await publishNotification({
          userId: updatedJob.createdBy,
          title: "Inventory Import Failed",
          message: `Spreadsheet '${updatedJob.fileName}' failed to process.`,
          type: "IMPORT_FAILED",
          metadata: {
            jobId: updatedJob.id,
            fileName: updatedJob.fileName || "unknown_file.xlsx",
            branchCode: updatedJob.branch?.code || "unknown",
            errorMessage: `${errorName}: ${errorMessage}`,
          },
        });
      }
    } catch (notiErr: any) {
      console.error("Failed to trigger failure notification:", notiErr.message);
    }

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

/**
 * Publish notification payload to SNS Topic (Production) or direct post to NestJS Webhook (Local Dev).
 */
async function publishNotification(payload: any) {
  const snsTopicArn = process.env.NOTIFICATION_SNS_TOPIC_ARN;
  const awsRegion = process.env.AWS_REGION || "ap-southeast-1";

  if (snsTopicArn) {
    try {
      const snsClient = new SNSClient({ region: awsRegion });
      const command = new PublishCommand({
        TopicArn: snsTopicArn,
        Message: JSON.stringify(payload),
      });
      await snsClient.send(command);
      console.log("Successfully published failure notification message to SNS.");
    } catch (err: any) {
      console.error("Failed to publish SNS failure message:", err.message);
    }
  } else {
    // Local dev: Fallback to direct NestJS Webhook post to enable easy offline mock testing
    const localWebhookUrl =
      process.env.LOCAL_API_WEBHOOK_URL || "http://localhost:8000/api/notifications/sns-callback";
    console.warn(
      `NOTIFICATION_SNS_TOPIC_ARN environment variable not found. Direct posting to local webhook: ${localWebhookUrl}`,
    );
    try {
      const response = await fetch(localWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        console.log("Successfully triggered local notification callback direct post.");
      } else {
        console.error(
          "Failed to trigger local notification callback direct post. Status:",
          response.status,
        );
      }
    } catch (err: any) {
      console.error(
        "Failed to trigger local notification callback direct post. Status:",
        err.message,
      );
    }
  }
}

module.exports = { handler };
