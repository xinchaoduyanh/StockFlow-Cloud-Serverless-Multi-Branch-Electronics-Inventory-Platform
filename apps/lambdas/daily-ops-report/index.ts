import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { PrismaClient } from "@prisma/client";
import { withDatabaseUrl } from "@stockflow/shared/dist/database-url";
import { createLogger, withObservability } from "@stockflow/shared/dist/logger";
import {
  OPS_REPORT_WINDOW_HOURS,
  buildOpsReportSubject,
  computeOpsStatus,
  type OpsReportData,
} from "@stockflow/shared/dist/ops-report";
import { DailyOpsReportEmail } from "@stockflow/shared/dist/templates/DailyOpsReportEmail";
import {
  collectAlarmsInAlarm,
  collectApiSection,
  collectBusinessSection,
  collectEstimatedCharges,
  collectLambdaSection,
  collectQueueDepths,
  collectTopEndpoints,
  type CollectorConfig,
} from "./collectors";

const logger = createLogger("daily-ops-report");
const prisma = new PrismaClient();
const ses = new SESClient({});

const HOUR_MS = 60 * 60 * 1000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

function loadConfig(now: Date): CollectorConfig {
  const windowMs = OPS_REPORT_WINDOW_HOURS * HOUR_MS;
  const start = new Date(now.getTime() - windowMs);
  return {
    window: { start, end: now },
    previousWindow: { start: new Date(start.getTime() - windowMs), end: start },
    projectPrefix: requireEnv("PROJECT_PREFIX"),
    apiId: requireEnv("API_ID"),
    apiLambdaName: requireEnv("API_LAMBDA_NAME"),
    lambdaNames: requireEnv("LAMBDA_NAMES").split(","),
    deadLetterQueueNames: requireEnv("DLQ_NAMES").split(","),
    apiAccessLogGroup: requireEnv("API_ACCESS_LOG_GROUP"),
    apiLogGroup: requireEnv("API_LOG_GROUP"),
  };
}

// Một nguồn lỗi không được làm mất cả báo cáo: phần đó thành null và email báo "không lấy được".
async function settle<T>(source: string, collect: () => Promise<T>): Promise<T | null> {
  try {
    return await collect();
  } catch (error) {
    logger.error(
      `Failed to collect ${source}`,
      error instanceof Error ? error : new Error(String(error)),
    );
    return null;
  }
}

async function collectReport(config: CollectorConfig): Promise<OpsReportData> {
  const [api, topEndpoints, lambda, deadLetterQueues, alarmsInAlarm, business, charges] =
    await Promise.all([
      settle("api metrics", () => collectApiSection(config)),
      settle("top endpoints", () => collectTopEndpoints(config)),
      settle("lambda metrics", () => collectLambdaSection(config)),
      settle("dead-letter queues", () => collectQueueDepths(config)),
      settle("alarms", () => collectAlarmsInAlarm(config)),
      settle("business metrics", () => collectBusinessSection(prisma, config.window)),
      settle("estimated charges", () => collectEstimatedCharges(config)),
    ]);

  return {
    periodStart: config.window.start.toISOString(),
    periodEnd: config.window.end.toISOString(),
    api,
    topEndpoints,
    lambda,
    deadLetterQueues,
    alarmsInAlarm,
    business,
    estimatedChargesUsd: charges,
  };
}

// EventBridge Scheduler gọi lúc 07:00 ICT. Scheduler retry chỉ tạo thêm một email giống nhau,
// không có tác dụng phụ nào khác nên handler vẫn idempotent.
const handler = async (): Promise<{ status: string; subject: string }> => {
  const now = new Date();
  const data = await collectReport(loadConfig(now));
  const status = computeOpsStatus(data);
  const reportDate = now.toISOString().slice(0, 10);
  const subject = buildOpsReportSubject(status, reportDate);

  await ses.send(
    new SendEmailCommand({
      Source: requireEnv("SYSTEM_FROM_EMAIL"),
      Destination: { ToAddresses: [requireEnv("OPS_REPORT_EMAIL")] },
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: DailyOpsReportEmail({ status, reportDate, data }), Charset: "UTF-8" },
        },
      },
    }),
  );

  logger.info("Daily ops report sent", { status, subject });
  return { status, subject };
};

module.exports = { handler: withObservability(logger, withDatabaseUrl(handler)) };
