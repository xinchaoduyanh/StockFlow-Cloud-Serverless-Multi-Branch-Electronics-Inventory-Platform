-- E3 persistence for idempotent report processing, import recovery, audit, and SNS deduplication.
ALTER TYPE "ExportJobStatus" ADD VALUE IF NOT EXISTS 'DISCARDED';

CREATE TYPE "RecoveryItemStatus" AS ENUM ('OPEN', 'REPLAYING', 'RESOLVED', 'DISCARDED');
CREATE TYPE "ImportRecoveryTerminalStatus" AS ENUM ('FAILED', 'TIMED_OUT', 'ABORTED', 'STALE');

ALTER TABLE "export_jobs"
  ADD COLUMN "last_error_code" VARCHAR(100),
  ADD COLUMN "discard_reason" TEXT,
  ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "processing_started_at" TIMESTAMP(3),
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "import_jobs"
  ADD COLUMN "execution_arn" TEXT,
  ADD COLUMN "replay_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "notifications"
  ADD COLUMN "source_message_id" VARCHAR(255);

CREATE TABLE "import_recovery_items" (
  "id" UUID NOT NULL,
  "import_job_id" UUID NOT NULL,
  "execution_arn" TEXT,
  "event_id" VARCHAR(255),
  "terminal_status" "ImportRecoveryTerminalStatus" NOT NULL,
  "status" "RecoveryItemStatus" NOT NULL DEFAULT 'OPEN',
  "error_code" VARCHAR(100),
  "error_message" TEXT,
  "receive_count" INTEGER,
  "replay_count" INTEGER NOT NULL DEFAULT 0,
  "last_action_by" UUID,
  "last_action_reason" TEXT,
  "last_replayed_at" TIMESTAMP(3),
  "resolved_at" TIMESTAMP(3),
  "discarded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "import_recovery_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL,
  "actor_id" UUID,
  "action" VARCHAR(100) NOT NULL,
  "resource_type" VARCHAR(100) NOT NULL,
  "resource_id" VARCHAR(255) NOT NULL,
  "reason" TEXT,
  "before_summary" JSONB,
  "after_summary" JSONB,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

DROP INDEX "export_jobs_status_idx";
CREATE INDEX "export_jobs_status_created_at_idx" ON "export_jobs"("status", "created_at");
CREATE UNIQUE INDEX "import_jobs_execution_arn_key" ON "import_jobs"("execution_arn");
CREATE UNIQUE INDEX "notifications_source_message_id_key" ON "notifications"("source_message_id");
CREATE UNIQUE INDEX "import_recovery_items_execution_arn_key" ON "import_recovery_items"("execution_arn");
CREATE UNIQUE INDEX "import_recovery_items_event_id_key" ON "import_recovery_items"("event_id");
CREATE INDEX "import_recovery_items_import_job_id_idx" ON "import_recovery_items"("import_job_id");
CREATE INDEX "import_recovery_items_status_created_at_idx" ON "import_recovery_items"("status", "created_at");
CREATE INDEX "audit_logs_resource_type_resource_id_created_at_idx" ON "audit_logs"("resource_type", "resource_id", "created_at");
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

ALTER TABLE "import_recovery_items"
  ADD CONSTRAINT "import_recovery_items_import_job_id_fkey"
  FOREIGN KEY ("import_job_id") REFERENCES "import_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
