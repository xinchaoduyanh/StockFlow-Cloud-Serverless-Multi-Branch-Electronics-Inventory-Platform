import { z } from "zod";

const stringToBoolean = z.preprocess((val) => {
  if (typeof val === "string") {
    const cleaned = val
      .trim()
      .replace(/^['"]|['"]$/g, "")
      .toLowerCase();
    if (cleaned === "true" || cleaned === "1") return true;
    if (cleaned === "false" || cleaned === "0") return false;
  }
  return val;
}, z.boolean());

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z
      .string()
      .url()
      .default("postgresql://postgres:postgres@localhost:5432/stockflow_cloud?schema=public"),
    CORS_ORIGIN: z.string().default("http://localhost:3000"),
    SWAGGER_ENABLED: stringToBoolean.default(true),
    PRISMA_CONNECT_ON_BOOT: stringToBoolean.default(false),
    AWS_REGION: z.string().default("us-east-1"),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_S3_BUCKET: z.string().default("stockflow-imports-dev"),
    AWS_S3_ENDPOINT: z.string().optional(),
    REPORT_DISPATCH_MODE: z.enum(["local", "sqs"]).default("local"),
    REPORT_QUEUE_URL: z.string().url().optional(),
    REPORT_QUEUE_DLQ_URL: z.string().url().optional(),
    REPORT_MAX_RECEIVE_COUNT: z.coerce.number().int().positive().default(5),
    REPORT_PROCESSING_LEASE_SECONDS: z.coerce.number().int().positive().default(900),
    IMPORT_STATE_MACHINE_ARN: z.string().optional(),
    IMPORT_RECOVERY_QUEUE_URL: z.string().url().optional(),
    IMPORT_RECOVERY_DLQ_URL: z.string().url().optional(),
    IMPORT_APPROVAL_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(86400),
    IMPORT_MAX_REPLAY_COUNT: z.coerce.number().int().positive().default(3),
    NOTIFICATION_SNS_TOPIC_ARN: z.string().optional(),
    SNS_CALLBACK_ALLOW_LOCAL: stringToBoolean.default(false),
    RECONCILIATION_LAMBDA_ARN: z.string().optional(),
    COGNITO_REGION: z.string().default("ap-southeast-1"),
    COGNITO_USER_POOL_ID: z.string().optional(),
    COGNITO_CLIENT_ID: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && env.REPORT_DISPATCH_MODE !== "sqs") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["REPORT_DISPATCH_MODE"],
        message: "Production report dispatch must use SQS",
      });
    }

    if (env.NODE_ENV === "production" && !env.REPORT_QUEUE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["REPORT_QUEUE_URL"],
        message: "REPORT_QUEUE_URL is required in production",
      });
    }

    if (env.NODE_ENV === "production" && !env.REPORT_QUEUE_DLQ_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["REPORT_QUEUE_DLQ_URL"],
        message: "REPORT_QUEUE_DLQ_URL is required in production",
      });
    }

    if (env.NODE_ENV === "production" && !env.IMPORT_STATE_MACHINE_ARN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["IMPORT_STATE_MACHINE_ARN"],
        message: "IMPORT_STATE_MACHINE_ARN is required in production",
      });
    }

    if (env.NODE_ENV === "production" && !env.NOTIFICATION_SNS_TOPIC_ARN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NOTIFICATION_SNS_TOPIC_ARN"],
        message: "NOTIFICATION_SNS_TOPIC_ARN is required in production",
      });
    }

    if (env.NODE_ENV === "production" && env.SNS_CALLBACK_ALLOW_LOCAL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SNS_CALLBACK_ALLOW_LOCAL"],
        message: "Local SNS callback mode is disabled in production",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;
