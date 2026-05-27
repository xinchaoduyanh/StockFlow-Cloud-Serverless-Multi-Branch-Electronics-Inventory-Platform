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
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard, AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { NotificationType } from "@stockflow/shared";

@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

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
    // 1. AWS SNS Subscription Confirmation Challenge
    if (body.Type === "SubscriptionConfirmation") {
      const subscribeUrl = body.SubscribeURL;
      this.logger.log(`SNS Subscription Confirmation request received. URL: ${subscribeUrl}`);
      if (subscribeUrl) {
        await fetch(subscribeUrl);
        this.logger.log("SNS Subscription successfully confirmed.");
      }
      return { status: "CONFIRMED" };
    }

    // 2. AWS SNS Notification message processing
    if (body.Type === "Notification") {
      try {
        const payload = JSON.parse(body.Message);
        await this.notificationsService.createNotification(payload);
        return { status: "PROCESSED" };
      } catch (err: any) {
        this.logger.error(`Failed to process SNS callback: ${err.message}`, err.stack);
        return { status: "FAILED", error: err.message };
      }
    }

    // 3. Fallback: Direct Local JSON post (for local mock sam pipelines)
    try {
      await this.notificationsService.createNotification(body);
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
