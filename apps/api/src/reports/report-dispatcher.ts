import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { Injectable } from "@nestjs/common";
import { reportJobMessageSchema, REPORT_JOB_MESSAGE_VERSION } from "@stockflow/shared";
import { CORRELATION_ID_ATTRIBUTE, getCorrelationId } from "@stockflow/shared/dist/correlation";
import { EnvService } from "../config/env.service";
import { tracer } from "../common/tracing/tracer";

@Injectable()
export class ReportDispatcher {
  private readonly sqsClient: SQSClient;

  constructor(private readonly env: EnvService) {
    this.sqsClient = tracer.captureAWSv3Client(
      new SQSClient({ region: this.env.get("AWS_REGION") }),
    );
  }

  async dispatch(exportJobId: string): Promise<void> {
    const mode = this.env.get("REPORT_DISPATCH_MODE");

    if (mode === "local") {
      if (this.env.get("NODE_ENV") === "production") {
        throw new Error("Local report dispatch is disabled in production");
      }
      return;
    }

    const queueUrl = this.env.get("REPORT_QUEUE_URL");
    if (!queueUrl) {
      throw new Error("REPORT_QUEUE_URL is required for SQS report dispatch");
    }

    const message = reportJobMessageSchema.parse({
      version: REPORT_JOB_MESSAGE_VERSION,
      exportJobId,
    });

    const correlationId = getCorrelationId();

    await this.sqsClient.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(message),
        ...(correlationId && {
          MessageAttributes: {
            [CORRELATION_ID_ATTRIBUTE]: { DataType: "String", StringValue: correlationId },
          },
        }),
      }),
    );
  }
}
