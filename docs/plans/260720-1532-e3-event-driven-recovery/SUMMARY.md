# Implementation Plan: E3 Event-Driven Recovery

> Created: 2026-07-20 15:32:13 +0700
> Status: Draft

## Objective

- Close the verified E2 authorization and quality gaps that would make recovery unsafe.
- Replace direct report Lambda invocation with an SQS-backed, idempotent report pipeline and a real DLQ.
- Add retry-aware Step Functions error handling, approval timeout, terminal import recovery, audited replay/discard, and reproducible notification delivery.
- Make Terraform the only production owner for the affected AWS resources.

## Scope

### In scope

- E2 closure gate for report branch isolation, fail-closed authorization injection, authorization matrix tests, lint, and CI.
- Prisma persistence for report attempts, import recovery items, replay limits, notification deduplication, and audit records.
- SQS report queue/DLQ, Lambda event source mapping, partial batch response, alarms, and least-privilege IAM.
- Report recovery APIs and targeted admin UI.
- Step Functions retry/backoff/jitter, terminal failure semantics, approval timeout, and stale-job recovery.
- EventBridge terminal execution events, Import Recovery Queue, recovery worker, audited import replay/discard.
- Terraform-managed SNS HTTPS subscription, webhook verification, delivery DLQ, and idempotent notification handling.
- Tests, runbooks, README/architecture/backlog synchronization, and staged AWS smoke tests.

### Out of scope

- Transactional outbox.
- Full dashboard refactor.
- Transfer fulfillment, serial/warranty work, and reconciliation hardening.
- Automatic production deployment from CI.
- Rebuilding Terraform from scratch or adopting a second IaC owner.

## Architecture & Approach

```text
Report request
  -> ExportJob(PENDING)
  -> report-jobs SQS
  -> report-exporter Lambda
       -> conditional claim
       -> S3
       -> COMPLETED
       -> partial batch failure on error
  -> report-jobs-dlq after maxReceiveCount
  -> admin recovery + audited replay/discard

S3 import
  -> EventBridge
  -> Step Functions
       -> retry transient faults only
       -> approval wait with timeout
       -> fail-handler
       -> terminal Fail state
  -> Step Functions status event
  -> import-recovery SQS
  -> import-recovery-worker
  -> ImportRecoveryItem(OPEN)
  -> admin replay/discard with audit and max replay count

Import completion/failure
  -> SNS
  -> Terraform-managed HTTPS subscription
  -> verified/idempotent API webhook
  -> Notification
  -> SNS delivery DLQ on exhausted delivery retries
```

Design decisions:

- Use standard SQS queues. Job ordering is not required; idempotency is enforced by database state.
- Queue payloads contain a version and resource ID only. Database records remain the source of job metadata.
- Keep local synchronous report execution only behind an explicit non-production dispatch mode. Production fails configuration validation if no report queue URL exists.
- Persist import recovery events before acknowledging their SQS records. The queue is transport; `ImportRecoveryItem` is the operator-facing source.
- Replace the misleading `dlq-replay` Lambda with an `import-recovery-worker`; the API starts audited replay executions directly.
- Preserve notification failure isolation from inventory transactions, but return non-2xx from the SNS webhook when processing genuinely fails so SNS can retry.

## Phases

- [ ] **Phase 1: Close E2 and establish the gate** — Goal: make authorization fail closed and restore a trustworthy quality baseline.
- [ ] **Phase 2: Audit Terraform ownership** — Goal: prove there is one production owner before adding queues or subscriptions.
- [x] **Phase 3: Add recovery persistence and contracts** — Goal: introduce forward-compatible schema and typed event/API boundaries.
- [ ] **Phase 4: Build the report queue pipeline** — Goal: deliver an idempotent SQS-to-Lambda report flow with a real DLQ.
- [ ] **Phase 5: Add report recovery operations** — Goal: expose safe, audited report retry/redrive/discard controls.
- [ ] **Phase 6: Harden import orchestration and recovery** — Goal: make Step Functions failures observable, retry-correct, and recoverable.
- [ ] **Phase 7: Reproduce notification delivery** — Goal: manage the SNS subscription in Terraform and safely process retries.
- [ ] **Phase 8: Integrate the recovery console and prove E3** — Goal: finish the targeted UI, cloud smoke tests, docs, and rollback evidence.

## Key Changes

- `apps/api/prisma/schema.prisma` and a new migration for recovery/audit fields and tables.
- `apps/api/src/auth/authorization-policy.service.ts` and authorization API tests.
- `apps/api/src/reports/*` for dispatch and recovery services.
- `apps/api/src/imports/*`, replacing API-read stale mutation with explicit recovery.
- `apps/api/src/notifications/notifications.controller.ts` for verified SNS handling.
- `apps/api/src/recovery/*` as the admin recovery boundary.
- `apps/lambdas/report-exporter/index.ts` for SQS batch handling and idempotent claims.
- New `apps/lambdas/import-recovery-worker/index.ts`; remove `apps/lambdas/dlq-replay/index.ts` after parity.
- `infrastructure/terraform/serverless.tf`, `ecs.tf`, `outputs.tf`, and focused queue/notification Terraform files if splitting improves reviewability.
- `apps/web/src/features/recovery/*` and the recovery/report sections of `apps/web/src/app/dashboard/page.tsx`.
- `.github/workflows/quality.yml`, `eslint.config.mjs`, README/runbooks, and E2/E3 backlog evidence.

## Verification Strategy

- `npm run lint`
- `npm test -- --runInBand`
- `npm run build`
- `npm run build:lambdas`
- `npm --workspace apps/api run test:postgres`
- `terraform fmt -check -recursive`
- `terraform validate`
- Saved `terraform plan` review with no unexpected destroy/replace.
- AWS smoke tests for normal delivery, forced retry, DLQ transition, redrive idempotency, import terminal recovery, approval timeout, and SNS retry/deduplication.

## Dependencies

- `@aws-sdk/client-sqs` in the API workspace for report publish, queue attributes, and redrive operations.
- `@types/aws-lambda` for typed SQS/EventBridge Lambda events.
- A maintained SNS signature validator or a small verified implementation covered by fixture tests; choose the dependency during Phase 7 after checking Node 20 compatibility.
- Terraform CLI `>= 1.7` and authenticated AWS CLI for ownership and cloud verification. They are not available in the current scout environment.

## Risks & Mitigations

- Database row created but SQS send fails -> mark dispatch failure, return a retriable API error, and allow audited admin requeue; do not add an outbox in E3.
- Duplicate or concurrent SQS delivery -> conditional database claim, terminal-state no-op, deterministic S3 key, and partial batch response.
- Consumer returns a failure object instead of failing the record -> handler tests require thrown/returned batch failures and verify DLQ movement.
- Stuck `PROCESSING` job -> processing lease timestamp plus scheduled stale recovery.
- Step Functions catches an error and still ends `SUCCEEDED` -> fail-handler transitions to an explicit `Fail` state.
- Validation errors retried as infrastructure errors -> shared error taxonomy and separate non-retryable Choice/Catch path.
- Recovery replay creates duplicate execution -> deterministic execution name, persisted replay attempt, unique constraints, and bounded replay count.
- SNS webhook spoofing or SSRF -> verify signature, certificate host, topic ARN, and remove production direct-JSON fallback.
- Terraform/SAM ownership collision -> complete ownership matrix and saved-plan review before apply; remove deployable SAM template after parity.
- Base stack is currently destroyed -> code can be completed locally, but E3 cloud acceptance remains open until TF-2 through TF-4 are recreated and smoke-tested.

## Open Questions

- Confirm the proposed operational defaults during review: report `maxReceiveCount=5`, report Lambda timeout `120s`, queue visibility timeout `900s`, import approval timeout `24h`, and maximum import replay count `3`.
- Confirm whether the legacy `/admin/dlq/*` endpoints need one release of deprecated aliases or can be removed when the recovery UI switches.
- Confirm the production API base URL used by the Terraform SNS subscription; the repository currently implies `https://api.vuduyanh.id.vn`.

## Handoff

After review, either:

- **Validate** — refine the defaults or compatibility requirements above.
- **Confirm** — approve this plan for a later `execute-plan` session.
