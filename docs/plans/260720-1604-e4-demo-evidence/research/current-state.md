# E4 Scout: Current State

> Scouted: 2026-07-20 16:04 +0700

## Evidence snapshot

| Check | Result | Interpretation |
| --- | --- | --- |
| `npm test -- --runInBand` | 31 passed, 7 skipped | Unit/e2e baseline is green; PostgreSQL suite is skipped unless `RUN_POSTGRES_TESTS=1`. |
| `npm run build` | Pass | Shared, API, and web production builds compile. |
| `npm run build:lambdas` | Pass | Current legacy Lambda topology bundles successfully. This is not proof of E3 queue behavior. |
| `npm run lint` | Fail: 15,195 errors, 1,171 warnings | Root lint scans generated `.aws-sam/build` and other artifacts; source warnings/errors also remain. |
| `git diff --cached --check` | Pass | No staged whitespace errors detected. |
| Terraform CLI | Missing (`command not found`) | Terraform format/validate/plan/apply cannot be verified in this environment. |
| Terraform state | No workspace state found; lockfile exists | Cloud ownership and deployed topology are unverified locally. |

## E3 implementation status

The staged change set implements the E3 persistence/contracts foundation:

- `apps/api/prisma/schema.prisma` adds export recovery fields, import execution correlation, `ImportRecoveryItem`, `AuditLog`, notification source-message deduplication, and new statuses.
- `packages/shared/src/recovery.ts` adds versioned report messages, recovery action validation, replay bounds, queue metrics, and audit sanitization.
- The migration and PostgreSQL harness add uniqueness/serialization checks.

The planned runtime work is not present yet:

- `apps/api/src/reports/reports.service.ts` still imports `LambdaClient`/`InvokeCommand` and invokes `REPORT_EXPORTER_LAMBDA_ARN`.
- `apps/lambdas/report-exporter/index.ts` still accepts an unversioned direct payload, generates a timestamped non-deterministic S3 key, returns failed results instead of SQS batch failures, and disconnects Prisma on every invocation.
- `apps/api/src/dlq/dlq.service.ts`, `apps/lambdas/dlq-replay/index.ts`, and Terraform still own the legacy Lambda replay route.
- `apps/api/src/imports/imports.service.ts` still calls `recoverStaleJob` from a read/assert path.
- Terraform has no report SQS/DLQ, event source mapping, import recovery queue/worker, terminal execution rule, or notification subscription matching the E3 plan.
- `apps/lambdas/README.md` still presents SAM as a deployment owner, while the feature plan requires Terraform as the only production owner.

## E4 readiness gaps

1. No deployed/verified demo environment is available in the local workspace.
2. The seed has four records (ADMIN, WAREHOUSE, and two STORE_MANAGER users), but uses personal-looking emails, fixed Cognito subjects, and password `123`; it is not a safe parameterized demo credential flow.
3. `infrastructure/terraform/seed-db.ps1` runs migration and seed through an ECS one-off task, but there is no explicit reset/off evidence workflow.
4. API HTTP logs are plain text and contain method/path/status/duration/IP/user-agent only; they do not include correlation ID, actor, role, branch, resource IDs, or error code.
5. OpenTelemetry tracing exists, but does not replace searchable structured application logs or demonstrate propagation through asynchronous E3 paths.
6. No benchmark generator/runner or committed benchmark report exists; the repository only contains small test workbooks, including a 50-row file.
7. No dashboard/alarm Terraform resources or demo evidence artifacts are present.
8. Documentation still contains direct-Lambda/SAM claims that must not be used as E4 evidence until E3 parity is complete.

## Planning consequences

- E4 Phase 1 must close the E3 and Terraform gates before any cloud benchmark or portfolio recording.
- Observability work must be designed around the final E3 message contracts, otherwise correlation fields will be reworked when queue/recovery workers land.
- Demo seed work must be parameterized and isolated before deploying to a shared AWS account.
- Benchmark claims must distinguish local tests, warm cloud runs, cold-start runs, and failed/invalid-row rates.

