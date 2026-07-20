# Phase 03: Add Recovery Persistence and Contracts

## Objective

- Introduce the database and typed boundaries required for idempotent report/import recovery.

## Preconditions

- Phase 1 is complete.
- The migration naming timestamp is newer than existing migrations.

## Tasks

1. Add `DISCARDED` to `ExportJobStatus`.
2. Add `updatedAt`, `processingStartedAt`, `attemptCount`, `lastErrorCode`, and `discardReason` to `ExportJob`.
3. Add `executionArn` and `replayCount` to `ImportJob`; index/uniqueness must support execution correlation without blocking local imports.
4. Add `RecoveryItemStatus` and an `ImportRecoveryItem` model keyed uniquely by execution ARN.
5. Store terminal status, safe error code/message, receive metadata, replay count, actor/reason, and timestamps on recovery items.
6. Add a generic `AuditLog` model with actor, action, resource type/id, reason, safe before/after summaries, metadata, and timestamp.
7. Add an optional unique `sourceMessageId` to `Notification` for SNS at-least-once deduplication.
8. Create a Prisma migration with indexes for failed reports, open recovery items, execution ARN, and audit resource lookup.
9. Add a rollback SQL file or documented reversible sequence that preserves audit/recovery data.
10. Add versioned shared contracts for `ReportJobMessage`, Step Functions failure categories, recovery list/action requests, queue metrics, and audit action names.
11. Require a non-empty reason schema for replay/discard actions.
12. Add environment schema entries for report queue URL/DLQ URL, state machine ARN, recovery limits/timeouts, notification topic ARN, and explicit local report mode.
13. Add `@aws-sdk/client-sqs` and `@types/aws-lambda`; regenerate the lockfile with the repository package manager.
14. Run Prisma format/generate and update DTO serializers so `updatedAt` is actually present.
15. Add model/contract tests for replay bounds, reason validation, enum serialization, and notification deduplication.

## Verification

- Commands:
  - `npx prisma format --schema apps/api/prisma/schema.prisma`
  - `npm --workspace apps/api run prisma:generate`
  - `npm --workspace apps/api run test:postgres`
  - `npm test -- --runInBand`
  - `npm run build`
- Expected results:
  - The migration applies to an empty and an FR-2 database.
  - Existing export/import data remains readable.
  - Duplicate execution ARN and duplicate SNS message ID are handled deterministically.
  - No task token, credential, or raw queue payload is stored in `AuditLog`.

## Exit Criteria

- [x] Migration and rollback strategy are reviewed.
- [x] Contracts are versioned and shared across API/Lambdas.
- [x] Prisma generation, database tests, and builds pass.
