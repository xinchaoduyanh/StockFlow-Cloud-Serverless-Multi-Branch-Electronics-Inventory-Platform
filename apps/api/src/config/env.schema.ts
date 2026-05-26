import { z } from "zod";

const stringToBoolean = z.preprocess((val) => {
  if (typeof val === "string") {
    if (val.toLowerCase() === "true" || val === "1") return true;
    if (val.toLowerCase() === "false" || val === "0") return false;
  }
  return val;
}, z.boolean());

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z
    .string()
    .url()
    .default("postgresql://postgres:postgres@localhost:5432/stockflow_cloud?schema=public"),
  JWT_SECRET: z.string().min(1).default("dev-only-stockflow-secret"),
  JWT_EXPIRES_IN: z.string().min(1).default("1d"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  SWAGGER_ENABLED: stringToBoolean.default(true),
  PRISMA_CONNECT_ON_BOOT: stringToBoolean.default(false),
  AWS_REGION: z.string().default("us-east-1"),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().default("stockflow-imports-dev"),
  AWS_S3_ENDPOINT: z.string().optional(),
  REPORT_EXPORTER_LAMBDA_ARN: z.string().optional(),
  DLQ_REPLAY_LAMBDA_ARN: z.string().optional(),
  RECONCILIATION_LAMBDA_ARN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

