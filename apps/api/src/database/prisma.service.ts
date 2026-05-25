import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { EnvService } from "../config/env.service";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly env: EnvService) {
    super();
  }

  async onModuleInit() {
    if (this.env.get("PRISMA_CONNECT_ON_BOOT")) {
      try {
        await this.$connect();
        console.log("[Prisma] Database connection successfully established on boot.");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn("[Prisma] Warning: Unable to establish database connection on boot:", message);
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
