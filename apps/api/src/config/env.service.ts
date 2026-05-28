import { Injectable } from "@nestjs/common";
import { Env, envSchema } from "./env.schema";

@Injectable()
export class EnvService {
  private readonly env: Env;

  constructor() {
    // Sanitize environment variables by stripping surrounding quotes and trimming whitespace
    // AWS Fargate preserves quotes (e.g. '"true"' or '"false"') when downloading the .env from S3
    const sanitizedEnv = { ...process.env };
    for (const [key, value] of Object.entries(sanitizedEnv)) {
      if (typeof value === "string") {
        sanitizedEnv[key] = value.trim().replace(/^['"]|['"]$/g, "");
      }
    }

    const parsed = envSchema.safeParse(sanitizedEnv);

    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      throw new Error(`Invalid environment variables: ${details}`);
    }

    this.env = parsed.data;

    for (const [key, value] of Object.entries(this.env)) {
      process.env[key] = String(value);
    }
  }

  get<K extends keyof Env>(key: K): Env[K] {
    return this.env[key];
  }
}
