import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  UseGuards,
  Req,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard, AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { notificationCallbackPayloadSchema, NotificationType } from "@stockflow/shared";
import { EnvService } from "../config/env.service";
import { isAllowedSnsSubscriptionUrl, verifySnsEnvelope } from "./sns-verification";

@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly env: EnvService,
  ) {}

  @ApiOperation({ summary: "Get all in-app notifications for the logged-in user." })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  async getNotifications(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.getUserNotifications(req.user.sub);
  }

  @ApiOperation({ summary: "Mark a specific notification as read." })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(":id/read")
  async markAsRead(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.notificationsService.markAsRead(id, req.user.sub);
  }

  @ApiOperation({ summary: "Mark all unread notifications for the user as read." })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post("read-all")
  async markAllAsRead(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.markAllAsRead(req.user.sub);
  }

  @ApiOperation({ summary: "AWS SNS Webhook callback handler." })
  @HttpCode(HttpStatus.OK)
  @Post("sns-callback")
  async handleSnsCallback(@Body() body: any) {
    const isLocal =
      this.env.get("NODE_ENV") !== "production" && this.env.get("SNS_CALLBACK_ALLOW_LOCAL");
    const isSnsEnvelope =
      body?.Type === "Notification" || body?.Type === "SubscriptionConfirmation";
    if (isSnsEnvelope) {
      const region = this.env.get("AWS_REGION");
      const topicArn = this.env.get("NOTIFICATION_SNS_TOPIC_ARN");
      if (!topicArn || body.TopicArn !== topicArn || !(await verifySnsEnvelope(body, region))) {
        throw new ForbiddenException("Invalid SNS signature or topic");
      }
    } else if (!isLocal) {
      throw new ForbiddenException("Direct notification payloads are disabled");
    }

    // 1. AWS SNS Subscription Confirmation Challenge
    if (body.Type === "SubscriptionConfirmation") {
      const subscribeUrl = body.SubscribeURL;
      this.logger.log(`SNS Subscription Confirmation request received. URL: ${subscribeUrl}`);
      if (!subscribeUrl || !isAllowedSnsSubscriptionUrl(subscribeUrl, this.env.get("AWS_REGION")))
        throw new BadRequestException("Invalid SNS confirmation URL");
      const confirmation = await fetch(subscribeUrl, {
        signal: AbortSignal.timeout(5000),
      });
      if (!confirmation.ok) {
        throw new Error(`SNS confirmation failed with status ${confirmation.status}`);
      }
      this.logger.log("SNS Subscription successfully confirmed.");
      return { status: "CONFIRMED" };
    }

    // 2. AWS SNS Notification message processing
    if (body.Type === "Notification") {
      try {
        const payload = notificationCallbackPayloadSchema.parse(JSON.parse(body.Message));
        await this.notificationsService.createNotification({
          ...payload,
          sourceMessageId: body.MessageId,
        });
        return { status: "PROCESSED" };
      } catch (err: any) {
        this.logger.error(`Failed to process SNS callback: ${err.message}`, err.stack);
        throw err;
      }
    }

    // 3. Fallback: Direct Local JSON post (for local mock sam pipelines)
    try {
      await this.notificationsService.createNotification(
        notificationCallbackPayloadSchema.parse(body),
      );
      return { status: "PROCESSED_DIRECT" };
    } catch (err: any) {
      this.logger.error(
        `Failed to process direct local notification payload: ${err.message}`,
        err.stack,
      );
      return { status: "FAILED", error: err.message };
    }
  }

  @ApiOperation({
    summary: "Developer route: Mock send two high-fidelity email/in-app test templates.",
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @Post("test")
  async triggerTestNotifications(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;

    // 1. Trigger Mock Success Notification
    const successNoti = await this.prismaCreateSuccess(userId);

    // 2. Trigger Mock Failure Notification (timeout example)
    const failureNoti = await this.prismaCreateFailure(userId);

    return {
      message: "Test notifications successfully triggered in the background!",
      successNotificationId: successNoti.id,
      failureNotificationId: failureNoti.id,
      previewLog: "Check your local temp-emails/ folder for compiled HTML previews!",
    };
  }

  private async prismaCreateSuccess(userId: string) {
    return this.notificationsService.createNotification({
      userId,
      title: "Inventory Import Succeeded",
      message: "Spreadsheet 'electronics_q2.xlsx' committed 450 items with 0 skipped warnings.",
      type: NotificationType.IMPORT_SUCCESS,
      metadata: {
        jobId: `test-success-job-${Date.now()}`,
        fileName: "electronics_q2.xlsx",
        branchCode: "BR001",
        totalRows: 450,
        validRows: 450,
        invalidRows: 0,
        committedRows: 450,
      },
    });
  }

  private async prismaCreateFailure(userId: string) {
    return this.notificationsService.createNotification({
      userId,
      title: "Inventory Import Timeout Failure",
      message:
        "Spreadsheet 'broken_headers.xlsx' failed to process due to structural columns validator mismatch.",
      type: NotificationType.IMPORT_FAILED,
      metadata: {
        jobId: `test-failed-job-${Date.now()}`,
        fileName: "broken_headers.xlsx",
        branchCode: "BR002",
        errorMessage:
          "Prisma Schema structural constraints error: Missing required column headers: 'sku', 'category'. Valid headers list should match the specified components template specifications.",
      },
    });
  }
}
