import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { Injectable } from "@nestjs/common";
import { reportJobMessageSchema, REPORT_JOB_MESSAGE_VERSION } from "@stockflow/shared";
import { EnvService } from "../config/env.service";

@Injectable()
export class ReportDispatcher {
  private readonly sqsClient: SQSClient;

  constructor(private readonly env: EnvService) {
    this.sqsClient = new SQSClient({ region: this.env.get("AWS_REGION") });
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

    await this.sqsClient.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(message),
      }),
    );
  }
}
