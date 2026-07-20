import {
  AuditAction,
  canReplayImportRecovery,
  ImportFailureCategory,
  RecoveryItemStatus,
  reportJobMessageSchema,
  recoveryActionBodySchema,
  sanitizeAuditSummary,
} from "@stockflow/shared";

describe("E3 recovery contracts", () => {
  const exportJobId = "11111111-1111-4111-8111-111111111111";

  it("accepts only the current versioned report-job message", () => {
    expect(reportJobMessageSchema.safeParse({ version: 1, exportJobId }).success).toBe(true);
    expect(reportJobMessageSchema.safeParse({ version: 2, exportJobId }).success).toBe(false);
    expect(
      reportJobMessageSchema.safeParse({ version: 1, exportJobId: "not-a-uuid" }).success,
    ).toBe(false);
  });

  it("requires a meaningful reason for recovery actions", () => {
    expect(recoveryActionBodySchema.safeParse({ reason: "   " }).success).toBe(false);
    expect(recoveryActionBodySchema.parse({ reason: "retry after AWS outage" })).toEqual({
      reason: "retry after AWS outage",
    });
  });

  it("enforces open-state replay bounds", () => {
    expect(canReplayImportRecovery(RecoveryItemStatus.OPEN, 0)).toBe(true);
    expect(canReplayImportRecovery(RecoveryItemStatus.OPEN, 2)).toBe(true);
    expect(canReplayImportRecovery(RecoveryItemStatus.OPEN, 3)).toBe(false);
    expect(canReplayImportRecovery(RecoveryItemStatus.REPLAYING, 0)).toBe(false);
  });

  it("serializes recovery enums and audit actions as stable strings", () => {
    expect(ImportFailureCategory.TRANSIENT).toBe("TRANSIENT");
    expect(RecoveryItemStatus.DISCARDED).toBe("DISCARDED");
    expect(AuditAction.IMPORT_REPLAY_REQUESTED).toBe("IMPORT_REPLAY_REQUESTED");
  });

  it("strips secrets, task tokens, and raw payloads from audit summaries", () => {
    expect(
      sanitizeAuditSummary({
        status: "FAILED",
        awsTaskToken: "secret-task-token",
        nested: { receiptHandle: "receipt", safe: "kept" },
        rawPayload: { records: ["sensitive"] },
      }),
    ).toEqual({ status: "FAILED", nested: { safe: "kept" } });
  });
});
