# Implementation Plan: E4 Demo, Observability and Evidence

> Created: 2026-07-20 16:04:09 +0700
> Status: Blocked — Phase 1 E3/TF entry gate

## Objective

- Turn the verified E3 platform into a reproducible, reviewable demo with realistic multi-branch data, role-based walkthroughs, structured operational telemetry, measurable import benchmarks, and an honest cost story.
- Produce evidence that a reviewer can replay without relying on local-only behavior, undocumented console changes, or unmeasured performance claims.

## Current Gate

E4 is not ready for implementation yet. The current branch contains the E3 persistence/contracts foundation, but E3 runtime and cloud acceptance are still open:

- Report API still invokes Lambda directly; no report SQS/DLQ consumer path is present.
- The legacy `dlq-replay` Lambda, direct Lambda IAM permissions, and API stale-job mutation still exist.
- Terraform still declares the old eight-Lambda/SAM-shaped topology and no E3 report/recovery queues.
- Local tests and production builds pass, but the root lint command fails because it scans generated `.aws-sam/build`/`dist` artifacts and source warnings/errors remain.
- Terraform CLI is not installed in the current scout environment, so no Terraform validation, plan, apply, or cloud smoke evidence is available yet.

E4 implementation starts only after the Phase 1 gate in this plan records E3/TF evidence.

## Scope

### In scope

- Terraform-backed demo environment bootstrap, migration, seed/reset flow, and cost-safe `system_on` operation.
- Three demo personas: ADMIN, WAREHOUSE, and STORE_MANAGER, with branch-isolation walkthroughs.
- Correlation IDs and structured logs across API, Lambda, SQS, and Step Functions paths.
- CloudWatch dashboard and alarms for API, Lambda, Step Functions, SQS/DLQ, and database health.
- Deterministic 10k and 50k import datasets, repeatable benchmark runner, evidence capture, and benchmark report.
- Cost breakdown, rollback/off runbook, architecture diagram refresh, demo script, and CV/portfolio claims backed by evidence.

### Out of scope

- New inventory, transfer, serial, warranty, or reconciliation business features.
- Replacing the E3 recovery architecture with an outbox or a new event platform.
- Production CI/CD automation beyond the evidence needed to deploy and tear down the demo.
- Publishing secrets, credentials, Terraform state, raw customer data, or unverified performance/cost claims.

## Architecture & Approach

1. Treat Terraform as the only production/demo infrastructure owner. Resolve the old SAM documentation/template and direct Lambda ownership before E4 cloud evidence.
2. Use a short-lived staging/demo environment with `system_on=true` only during deployment and test windows; turn it off using the documented switch after evidence capture.
3. Keep demo identity data separate from personal/production identities. Seed database records and Cognito users from environment-provided demo configuration, with forced password rotation or temporary credentials.
4. Propagate one validated `correlationId` through HTTP response headers, API logs, queue messages, Step Functions input, Lambda logs, and recovery records. Never log tokens, credentials, raw Excel rows, or queue payload bodies.
5. Benchmark the actual deployed import path. Record environment, input checksum, file size, phase timings, rows/sec, memory, errors, and cost assumptions beside every result.

## Phases

- [~] **Phase 1: Close E3/TF entry gate** — Goal: prove the platform is deployable and E3 runtime semantics are active before demo work.
- [ ] **Phase 2: Build the demo environment and personas** — Goal: make the main inventory/import/report/recovery flows reproducible for three roles.
- [ ] **Phase 3: Add correlation-aware structured telemetry** — Goal: trace a user action across API, asynchronous workers, and orchestration.
- [ ] **Phase 4: Add dashboards and actionable alarms** — Goal: detect latency, errors, stuck workflows, queue backlog, and DLQ movement.
- [ ] **Phase 5: Run reproducible 10k/50k import benchmarks** — Goal: produce measured throughput and failure evidence without overclaiming.
- [ ] **Phase 6: Package cost, rollback, docs, and portfolio evidence** — Goal: hand off a truthful, repeatable demo package.

## Key Changes

- `infrastructure/terraform/serverless.tf`, `ecs.tf`, `outputs.tf`, and new focused observability/queue resources after E3 parity is complete.
- `infrastructure/terraform/seed-db.ps1` plus a new demo seed/reset entry point or explicitly scoped seed mode.
- `apps/api/src/common/middleware/http-logger.middleware.ts`, new request-context/correlation utilities, exception logging, and tests.
- Lambda handlers and shared contracts for correlation metadata and safe structured event fields.
- `apps/web/src/app/dashboard/page.tsx` and feature modules only where the demo requires clear role/recovery states.
- New benchmark generator/runner and evidence files under `scripts/benchmark/` and `docs/evidence/` (with generated data/state ignored).
- `README.md`, `apps/api/README.md`, `apps/lambdas/README.md`, `infrastructure/README.md`, `docs/README.md`, architecture diagrams, and demo runbook.

## Verification Strategy

- E3 gate: `npm test -- --runInBand`, `npm run build`, `npm run build:lambdas`, corrected scoped lint, `terraform fmt -check -recursive`, `terraform validate`, and saved `terraform plan` review.
- Demo gate: deploy, migrate, seed, login as all three roles, verify allowed/denied branch actions, run report/import/recovery flows, and verify reset/off procedure.
- Observability gate: every test flow yields a correlation ID that is searchable in API/Lambda/Step Functions logs without sensitive fields.
- Alarm gate: create controlled API/Lambda/SFN/queue failures and verify alarm state, recovery action, and clear/reset behavior.
- Benchmark gate: each 10k/50k run has a checksum, configuration snapshot, phase timings, result status, and reproducible command.
- Final gate: `git diff --check`, secret/state/artifact scan, docs/diagram consistency review, and no unverified CV metrics.

## Dependencies

- Terraform CLI compatible with the repository lockfile and authenticated AWS CLI access.
- E3 runtime implementation and cloud resources: report queue/DLQ, import recovery queue/worker, Step Functions retry/timeout, notification subscription, and recovery API/UI.
- A non-production AWS account/environment with budget monitoring and permission to create/delete the demo resources.
- Cognito demo-user provisioning path and a safe secret delivery mechanism for demo credentials.
- A database endpoint reachable by the deployed ECS/Lambda path and an approved benchmark window.

## Risks & Mitigations

- E3 is only partially implemented → keep Phase 1 as a hard gate; do not record demo success from local synchronous mode.
- Existing lint scans generated artifacts → ignore generated directories explicitly and run scoped source lint; fix remaining source errors before CI evidence.
- Seed script contains personal-looking identities and password `123` → replace with parameterized demo identities and generated/rotated credentials before deployment.
- Benchmark results are distorted by Aurora cold start, NAT, or noisy shared infrastructure → record warm/cold state and run count; publish median plus range, not one best run.
- Alarms create cost/noise after demo → use thresholds and notification endpoints as variables, document `system_on=false`, and verify teardown.
- Terraform/SAM ownership collision → perform ownership matrix and saved-plan review before apply; keep no deployable second owner.
- Correlation IDs leak sensitive data through logs → validate format, cap length, allow only safe metadata, and add redaction tests.

## Open Questions

- Confirm the demo hostname and whether `app.vuduyanh.id.vn`/`api.vuduyanh.id.vn` remain the intended temporary endpoints.
- Confirm the benchmark success target: throughput only, or also a maximum total duration/SLA for 10k and 50k.
- Confirm where alarm notifications should go (email/SNS only, or an existing incident channel).
- Confirm whether demo credentials may be shown in the recording or must be entered off-screen.

## Handoff

After review:

- **Validate** — adjust demo host, benchmark target, or alarm destination.
- **Confirm** — approve this plan for a later `execute-plan` session.
