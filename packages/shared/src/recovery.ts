import { z } from "zod";
import { paginationQuerySchema } from "./reconciliation";

export const REPORT_JOB_MESSAGE_VERSION = 1 as const;

export const reportJobMessageSchema = z.object({
  version: z.literal(REPORT_JOB_MESSAGE_VERSION),
  exportJobId: z.string().uuid(),
});

export type ReportJobMessage = z.infer<typeof reportJobMessageSchema>;

export const ImportFailureCategory = {
  BUSINESS: "BUSINESS",
  TRANSIENT: "TRANSIENT",
  TERMINAL: "TERMINAL",
} as const;
export type ImportFailureCategory =
  (typeof ImportFailureCategory)[keyof typeof ImportFailureCategory];

export const IMPORT_TERMINAL_STATUSES = ["FAILED", "TIMED_OUT", "ABORTED", "STALE"] as const;
export type ImportTerminalStatus = (typeof IMPORT_TERMINAL_STATUSES)[number];

export const RecoveryItemStatus = {
  OPEN: "OPEN",
  REPLAYING: "REPLAYING",
  RESOLVED: "RESOLVED",
  DISCARDED: "DISCARDED",
} as const;
export type RecoveryItemStatus = (typeof RecoveryItemStatus)[keyof typeof RecoveryItemStatus];

export const AuditAction = {
  REPORT_REPLAY_REQUESTED: "REPORT_REPLAY_REQUESTED",
  REPORT_DISCARDED: "REPORT_DISCARDED",
  REPORT_DLQ_REDRIVE_STARTED: "REPORT_DLQ_REDRIVE_STARTED",
  IMPORT_REPLAY_REQUESTED: "IMPORT_REPLAY_REQUESTED",
  IMPORT_DISCARDED: "IMPORT_DISCARDED",
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const recoveryActionBodySchema = z.object({
  reason: z.string().trim().min(1, "A recovery reason is required").max(1000),
});

export const importRecoveryListQuerySchema = paginationQuerySchema.extend({
  status: z
    .enum(Object.values(RecoveryItemStatus) as [RecoveryItemStatus, ...RecoveryItemStatus[]])
    .optional(),
  importJobId: z.string().uuid().optional(),
});

export type RecoveryActionBody = z.infer<typeof recoveryActionBodySchema>;
export type ImportRecoveryListQuery = z.infer<typeof importRecoveryListQuerySchema>;

export interface QueueMetrics {
  availableMessages: number;
  inFlightMessages: number;
  oldestMessageAgeSeconds: number | null;
}

export interface ImportRecoveryItemDTO {
  id: string;
  importJobId: string;
  executionArn: string | null;
  terminalStatus: ImportTerminalStatus;
  status: RecoveryItemStatus;
  errorCode: string | null;
  errorMessage: string | null;
  receiveCount: number | null;
  replayCount: number;
  lastActionBy: string | null;
  lastActionReason: string | null;
  lastReplayedAt: string | Date | null;
  resolvedAt: string | Date | null;
  discardedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export const MAX_IMPORT_RECOVERY_REPLAYS = 3;

export function canReplayImportRecovery(
  status: RecoveryItemStatus,
  replayCount: number,
  maxReplayCount = MAX_IMPORT_RECOVERY_REPLAYS,
): boolean {
  return status === RecoveryItemStatus.OPEN && replayCount < maxReplayCount;
}

const SENSITIVE_AUDIT_FIELD =
  /(token|secret|password|authorization|credential|receipt.?handle|raw.?payload|message.?body)/i;

/**
 * Removes values that must never enter a persisted audit record. Recovery code
 * should pass its before/after summaries through this boundary before writing.
 */
export function sanitizeAuditSummary(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditSummary(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !SENSITIVE_AUDIT_FIELD.test(key))
        .map(([key, nestedValue]) => [key, sanitizeAuditSummary(nestedValue)]),
    );
  }

  return value;
}
