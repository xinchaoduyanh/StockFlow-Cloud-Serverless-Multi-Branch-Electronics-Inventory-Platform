import { Logger } from "@aws-lambda-powertools/logger";
import type { Context } from "aws-lambda";
import {
  CORRELATION_ID_ATTRIBUTE,
  extractCorrelationId,
  runWithCorrelationId,
} from "./correlation";

// Log JSON một dòng mỗi record: CloudWatch Logs Insights lọc được theo field,
// và EMF metric được CloudWatch trích từ chính dòng log.
export function createLogger(serviceName: string): Logger {
  return new Logger({ serviceName });
}

export { Logger };

// Bọc handler Lambda: gắn correlationId và thông tin invoke vào mọi log, log lỗi rồi ném lại
// để SQS/Step Functions vẫn thấy invoke thất bại và retry như trước.
export function withObservability<TEvent, TResult>(
  logger: Logger,
  handler: (event: TEvent, context: Context) => Promise<TResult>,
): (event: TEvent, context: Context) => Promise<TResult> {
  return async (event, context) => {
    logger.addContext(context);
    // Một batch SQS có thể gồm nhiều message; ID của message đầu đại diện cho cả invoke.
    const correlationId = extractCorrelationId(event) ?? context.awsRequestId;
    logger.appendKeys({ [CORRELATION_ID_ATTRIBUTE]: correlationId });
    try {
      return await runWithCorrelationId(correlationId, () => handler(event, context));
    } catch (error) {
      logger.error(
        "Lambda invocation failed",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    } finally {
      logger.removeKeys([CORRELATION_ID_ATTRIBUTE]);
    }
  };
}
