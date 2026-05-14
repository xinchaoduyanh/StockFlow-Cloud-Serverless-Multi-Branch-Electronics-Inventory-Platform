import { Injectable } from "@nestjs/common";
import { Env, envSchema } from "./env.schema";

@Injectable()
export class EnvService {
  private readonly env: Env;

  constructor() {
    const parsed = envSchema.safeParse(process.env);

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
