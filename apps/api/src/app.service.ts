import { Injectable } from "@nestjs/common";
import { EnvService } from "./config/env.service";
import { PrismaService } from "./database/prisma.service";

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly env: EnvService,
  ) {}

  async getHealth() {
    let dbStatus: string;
    try {
      // Warm up database connection pool and Neon DB proxy
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = "connected";
    } catch {
      dbStatus = "error";
    }

    return {
      service: "stockflow-api",
      status: "ok",
      database: dbStatus,
      commitSha: this.env.get("GIT_SHA"),
    };
  }
}
