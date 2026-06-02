import { Injectable, Logger } from "@nestjs/common";
import Pusher from "pusher";

@Injectable()
export class PusherService {
  private readonly logger = new Logger(PusherService.name);
  private pusher: Pusher | null = null;

  constructor() {
    const appId = process.env.PUSHER_APP_ID;
    const key = process.env.PUSHER_KEY;
    const secret = process.env.PUSHER_SECRET;
    const cluster = process.env.PUSHER_CLUSTER;

    if (!appId || !key || !secret || !cluster || key === "mock-pusher-key") {
      this.logger.warn(
        "Pusher configuration is incomplete or using mock keys. Real-time push notifications will be bypassed.",
      );
      return;
    }

    try {
      this.pusher = new Pusher({
        appId,
        key,
        secret,
        cluster,
        useTLS: true,
      });
      this.logger.log("Pusher client successfully initialized.");
    } catch (error: any) {
      this.logger.error("Failed to initialize Pusher client:", error.message);
    }
  }

  async triggerNotification(userId: string, data: any): Promise<void> {
    if (!this.pusher) {
      this.logger.warn(`Pusher is not initialized. Bypassing real-time push for user: ${userId}`);
      return;
    }

    try {
      await this.pusher.trigger(`user-${userId}`, "notification:new", data);
      this.logger.log(`Real-time notification pushed successfully to channel user-${userId}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to push real-time notification to user-${userId}: ${error.message}`,
      );
    }
  }
}
