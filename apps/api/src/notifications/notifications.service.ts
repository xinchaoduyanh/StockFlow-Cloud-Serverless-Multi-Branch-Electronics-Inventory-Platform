import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  CreateNotificationDto,
  NotificationType,
  NotificationBase,
  castNotificationRow,
} from "@stockflow/shared";
import { PrismaService } from "../database/prisma.service";
import { EmailService } from "./email.service";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Strictly type-safe Generic Notification Creation.
   * Leverages custom type mappings to guarantee metadata schemas match notification type at compile-time.
   */
  async createNotification<T extends NotificationType>(
    dto: CreateNotificationDto<T>,
  ): Promise<NotificationBase<T>> {
    // 1. Double-Delivery Deduplication Check (using Job ID in metadata)
    const jobId = (dto.metadata as any).jobId;
    if (jobId) {
      const existing = await this.prisma.notification.findFirst({
        where: {
          type: dto.type,
          metadata: {
            path: ["jobId"],
            equals: jobId,
          },
        },
      });

      if (existing) {
        this.logger.warn(
          `Deduplication Alert: Notification already exists for jobId: ${jobId}. Skipping duplicates.`,
        );
        return castNotificationRow<T>(existing);
      }
    }

    // 2. Safe Database Persistence using Prisma InputJsonValue (avoiding "as any")
    const record = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        title: dto.title,
        message: dto.message,
        type: dto.type,
        metadata: dto.metadata as unknown as Prisma.InputJsonValue,
      },
    });

    // 3. Fetch User's email address and uploader name
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { email: true, fullName: true },
    });

    if (user?.email) {
      // 4. Asynchronous Fire-and-Forget Email Dispatch (Non-blocking!)
      this.emailService
        .sendEmail(user.email, dto.title, dto.type, {
          uploaderName: user.fullName || "User",
          ...dto.metadata,
          completedAt: new Date().toLocaleString(),
          dashboardUrl: process.env.FRONTEND_URL || "http://localhost:3000/dashboard",
        })
        .catch((err: any) => {
          // Asynchronously captures email transmission failures ngầm để không block luồng trả HTTP
          this.logger.error(
            `Background AWS SES delivery failed for user ${user.email}: ${err.message}`,
            err.stack,
          );
        });
    }

    return castNotificationRow<T>(record);
  }

  /**
   * Retrieves a user's notification list ordered by newest first.
   */
  async getUserNotifications(userId: string): Promise<NotificationBase[]> {
    const records = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return records.map((record) => castNotificationRow(record));
  }

  /**
   * Marks a specific notification as read.
   */
  async markAsRead(notificationId: string, userId: string): Promise<NotificationBase> {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!existing) {
      throw new NotFoundException("Notification not found or access denied.");
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });

    return castNotificationRow(updated);
  }

  /**
   * Marks all unread user notifications as read.
   */
  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    return { count: result.count };
  }
}
