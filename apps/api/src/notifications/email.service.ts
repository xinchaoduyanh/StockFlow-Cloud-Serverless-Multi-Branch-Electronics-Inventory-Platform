import { Injectable, Logger } from "@nestjs/common";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { NotificationType, ImportSuccessEmail, ImportFailureEmail } from "@stockflow/shared";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private sesClient: SESClient | null = null;
  private readonly tempEmailsDir = path.join(process.cwd(), "temp-emails");

  constructor() {
    // Initialize SESClient if AWS region environment is configured
    const awsRegion = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
    if (awsRegion) {
      this.sesClient = new SESClient({ region: awsRegion });
      this.logger.log(`AWS SES Client initialized for region: ${awsRegion}`);
    } else {
      this.logger.warn("AWS SES credentials not found. Defaulting to Local HTML Mock Driver.");
      // Ensure temp-emails directory exists for local testing
      if (!fs.existsSync(this.tempEmailsDir)) {
        fs.mkdirSync(this.tempEmailsDir, { recursive: true });
        this.logger.log(`Created local temp-emails directory at: ${this.tempEmailsDir}`);
      }
    }
  }

  /**
   * Type-safe Email dispatch gateway.
   * Compiles TSX templates to pure strings and sends via SES (Prod) or saves locally (Dev).
   */
  async sendEmail<T>(to: string, subject: string, type: NotificationType, props: T): Promise<void> {
    let htmlContent: string;

    // 1. Compile the TSX Template into high-speed HTML String (0.01ms overhead)
    try {
      if (type === NotificationType.IMPORT_SUCCESS) {
        htmlContent = ImportSuccessEmail(props as any);
      } else if (type === NotificationType.IMPORT_FAILED) {
        htmlContent = ImportFailureEmail(props as any);
      } else {
        throw new Error(`Unsupported notification template type: ${type}`);
      }
    } catch (err: any) {
      this.logger.error(`Failed to compile TSX email template: ${err.message}`);
      throw err;
    }

    // 2. Dispatch to AWS SES (Production Mode) or Local temp folder (Development Mode)
    if (this.sesClient && process.env.NODE_ENV === "production") {
      try {
        const sourceEmail = process.env.SYSTEM_FROM_EMAIL || "no-reply@stockflow.cloud";
        const command = new SendEmailCommand({
          Source: sourceEmail,
          Destination: {
            ToAddresses: [to],
          },
          Message: {
            Subject: {
              Data: subject,
              Charset: "UTF-8",
            },
            Body: {
              Html: {
                Data: htmlContent,
                Charset: "UTF-8",
              },
            },
          },
        });

        await this.sesClient.send(command);
        this.logger.log(`Successfully dispatched email to: ${to} via AWS SES.`);
      } catch (err: any) {
        this.logger.error(`AWS SES delivery failed: ${err.message}`, err.stack);
        throw err;
      }
    } else {
      // Local Development: Write to file and log to console for instant developer preview
      try {
        const fileName = `${Date.now()}-${type.toLowerCase()}.html`;
        const filePath = path.join(this.tempEmailsDir, fileName);
        fs.writeFileSync(filePath, htmlContent, "utf8");

        this.logger.log(
          `[LOCAL DEVELOPMENT MOCK EMAIL]
Subject: ${subject}
To: ${to}
HTML Preview saved at: file://${filePath}
=========================================
`,
        );
      } catch (err: any) {
        this.logger.error(`Failed to save local mock email: ${err.message}`);
      }
    }
  }
}
