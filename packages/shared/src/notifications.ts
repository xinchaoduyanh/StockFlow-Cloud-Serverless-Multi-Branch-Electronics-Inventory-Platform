import { z } from "zod";

export const NotificationType = {
  IMPORT_SUCCESS: "IMPORT_SUCCESS",
  IMPORT_FAILED: "IMPORT_FAILED",
  RECONCILIATION_ALERT: "RECONCILIATION_ALERT",
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

const notificationBaseSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().trim().min(1).max(255),
  message: z.string().trim().min(1).max(2000),
});

export const notificationCallbackPayloadSchema = z.discriminatedUnion("type", [
  notificationBaseSchema.extend({
    type: z.literal(NotificationType.IMPORT_SUCCESS),
    metadata: z.object({
      jobId: z.string().uuid(),
      fileName: z.string(),
      branchCode: z.string(),
      totalRows: z.number().int().nonnegative(),
      validRows: z.number().int().nonnegative(),
      invalidRows: z.number().int().nonnegative(),
      committedRows: z.number().int().nonnegative(),
    }),
  }),
  notificationBaseSchema.extend({
    type: z.literal(NotificationType.IMPORT_FAILED),
    metadata: z.object({
      jobId: z.string().uuid(),
      fileName: z.string(),
      branchCode: z.string(),
      errorMessage: z.string(),
    }),
  }),
  notificationBaseSchema.extend({
    type: z.literal(NotificationType.RECONCILIATION_ALERT),
    metadata: z.object({
      issueId: z.string().uuid(),
      branchId: z.string().uuid(),
      branchCode: z.string(),
      sku: z.string(),
      difference: z.number(),
    }),
  }),
]);

export type NotificationCallbackPayload = z.infer<typeof notificationCallbackPayloadSchema>;

export interface ImportSuccessMetadata {
  jobId: string;
  fileName: string;
  branchCode: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  committedRows: number;
}

export interface ImportFailureMetadata {
  jobId: string;
  fileName: string;
  branchCode: string;
  errorMessage: string;
}

export interface ReconciliationAlertMetadata {
  issueId: string;
  branchId: string;
  branchCode: string;
  sku: string;
  difference: number;
}

export interface NotificationPayloadMap {
  [NotificationType.IMPORT_SUCCESS]: ImportSuccessMetadata;
  [NotificationType.IMPORT_FAILED]: ImportFailureMetadata;
  [NotificationType.RECONCILIATION_ALERT]: ReconciliationAlertMetadata;
}

export interface CreateNotificationDto<T extends NotificationType> {
  userId: string;
  sourceMessageId?: string;
  title: string;
  message: string;
  type: T;
  metadata: NotificationPayloadMap[T];
}

export interface NotificationBase<T extends NotificationType = NotificationType> {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: T;
  read: boolean;
  metadata: NotificationPayloadMap[T];
  createdAt: Date;
}

/**
 * Casts a raw Prisma database notification row into a strongly typed NotificationBase record.
 * Avoids raw 'as any' casting to protect application-level type contracts.
 */
export function castNotificationRow<T extends NotificationType>(row: {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  metadata: any;
  createdAt: Date;
}): NotificationBase<T> {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    message: row.message,
    type: row.type as T,
    read: row.read,
    metadata: row.metadata as unknown as NotificationPayloadMap[T],
    createdAt: row.createdAt,
  };
}
