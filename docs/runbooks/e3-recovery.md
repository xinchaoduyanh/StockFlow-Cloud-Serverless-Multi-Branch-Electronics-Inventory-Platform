# E3 Recovery Runbook

## Report jobs

- Inspect `GET /api/admin/recovery/reports` and `GET /api/admin/recovery/reports/queue` as an ADMIN.
- Replay or discard one job with a human reason. Completed and discarded jobs are idempotent no-ops for redelivered SQS messages.
- Start at most one report DLQ redrive at a time; the API caps redrive velocity at 10 messages/second.
- Investigate the `stockflow-report-dlq-visible` and `stockflow-report-queue-oldest-message` alarms before redriving.

## Import recovery

- Terminal Step Functions events are persisted in `ImportRecoveryItem` by `import-recovery-worker`.
- Replay and discard are ADMIN-only, audited, bounded to three attempts, and use a deterministic execution name.
- A replay is resolved only after a replacement execution emits a successful terminal event.
- The scheduled worker scan covers stale processing jobs without mutating normal API reads.

## Notification delivery

- The SNS HTTPS subscription is Terraform-managed and must be confirmed before smoke tests.
- The callback verifies the regional SNS certificate, signature, topic ARN, and confirmation URL.
- Inspect the notification delivery DLQ alarm before investigating application data; duplicate `MessageId` delivery is safe.
