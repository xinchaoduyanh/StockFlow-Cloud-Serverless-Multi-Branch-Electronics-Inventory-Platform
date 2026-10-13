import { withDatabaseUrl } from "@stockflow/shared/dist/database-url";
import { createLogger, withObservability } from "@stockflow/shared/dist/logger";
import { createTracer } from "@stockflow/shared/dist/tracer";
import { createMetricEmitter, MetricUnit } from "@stockflow/shared/dist/metrics";
import { PrismaClient, ImportStatus } from "@prisma/client";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const logger = createLogger("import-job-fail-handler");
const tracer = createTracer("import-job-fail-handler");
const emitMetric = createMetricEmitter("import-job-fail-handler");

const prisma = new PrismaClient();

const handler = async (event: any) => {
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
    logger.error("No importJobId found in the failure event payload.");
    throw new Error("No importJobId found");
  }

  try {
    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: ImportStatus.FAILED,
        errorMessage: `${errorName}: ${errorMessage}`,
      },
    });

    emitMetric("ImportJobFailed", MetricUnit.Count, 1);
    logger.info(`Import job ${importJobId} successfully marked as FAILED.`);

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
      logger.error("Failed to trigger failure notification", notiErr.message);
    }

    return {
      success: true,
      importJobId,
    };
  } catch (err: any) {
    logger.error("Failed to mark job as failed", err);
    throw err;
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
      const snsClient = tracer.captureAWSv3Client(new SNSClient({ region: awsRegion }));
      const command = new PublishCommand({
        TopicArn: snsTopicArn,
        Message: JSON.stringify(payload),
      });
      await snsClient.send(command);
      logger.info("Successfully published failure notification message to SNS.");
    } catch (err: any) {
      logger.error("Failed to publish SNS failure message", err.message);
    }
  } else if (
    process.env.NODE_ENV !== "production" &&
    process.env.SNS_CALLBACK_ALLOW_LOCAL === "true"
  ) {
    // Local dev: Fallback to direct NestJS Webhook post to enable easy offline mock testing
    const localWebhookUrl =
      process.env.LOCAL_API_WEBHOOK_URL || "http://localhost:8000/api/notifications/sns-callback";
    logger.warn(
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
        logger.info("Successfully triggered local notification callback direct post.");
      } else {
        logger.error(
          `Failed to trigger local notification callback direct post. Status: ${response.status}`,
        );
      }
    } catch (err: any) {
      logger.error(
        "Failed to trigger local notification callback direct post. Status",
        err.message,
      );
    }
  } else {
    logger.warn("Notification topic is not configured; failure notification was isolated.");
  }
}

module.exports = { handler: withObservability(logger, withDatabaseUrl(handler)) };
