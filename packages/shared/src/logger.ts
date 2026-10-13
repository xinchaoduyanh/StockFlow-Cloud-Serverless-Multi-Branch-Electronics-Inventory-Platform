import { Logger } from "@aws-lambda-powertools/logger";

// Log JSON một dòng mỗi record: CloudWatch Logs Insights lọc được theo field,
// và EMF metric (nếu có) được CloudWatch trích từ chính dòng log.
export function createLogger(serviceName: string): Logger {
  return new Logger({ serviceName });
}

export { Logger };
