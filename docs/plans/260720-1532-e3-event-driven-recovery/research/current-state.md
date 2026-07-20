# E2/E3 Scout Notes

> Captured: 2026-07-20 15:32:13 +0700

## Repository state

- Branch: `main`, one commit ahead of `origin/main`.
- E2 commit: `343c514 feat(api): enforce role and branch authorization`.
- Worktree remained clean after scout builds.
- No `.github/workflows` files exist.
- Terraform CLI was not installed in the scout environment, so Terraform findings are static until Phase 2.

## E3 implementation addendum — 2026-07-20

- Terraform v1.15.5 was made available in a temporary path for read-only `fmt`, `validate`, and `plan` checks.
- AWS identity is account `186818869522` / user `stockflowcloud`; `stockflow-pipeline` is absent and no stockflow serverless resources were found.
- The deployable SAM template and old direct replay Lambda were removed. Terraform plan output is retained outside the repository at `/tmp/stockflow-e3.tfplan`.
- Local code/IaC gates pass; cloud smoke acceptance remains pending an explicit apply checkpoint.

## Baseline evidence

- `npm test -- --runInBand`: 8 suites passed, 1 skipped; 24 tests passed, 4 skipped.
- `npm run build`: API, web, and shared builds passed.
- `npm run build:lambdas`: all eight current Lambdas built.
- `npm run lint`: failed.
- Source-only lint excluding generated `.aws-sam`: 21 errors and 202 warnings.
- The full lint command also scans ignored-by-Git `.aws-sam/build` because ESLint does not ignore it, producing about 15k generated-code errors.

## E2 findings

- Implemented:
  - Reusable `AuthorizationPolicyService`.
  - Branch scoping added to inventory/import/report/transfer services.
  - ADMIN guards added to DLQ and reconciliation controllers.
  - Transfer self-approval denial.
  - Five policy unit tests.
- Not complete against FR-2:
  - No API authorization matrix tests.
  - No CI workflow.
  - Lint does not pass.
  - E2 backlog/checklist is not updated.
  - Service authorization dependencies are optional and calls use optional chaining, which creates a fail-open wiring mode.
- Verified report authorization bypass:
  - `ReportsService.createExport` passes the current actor ID as `createdBy` into `assertCanReadReport`.
  - `assertCanReadReport` returns when actor equals creator before validating the requested branch.
  - The non-admin filter then preserves that requested branch.
  - A branch user can therefore create an export for a different branch.

## E3 current topology and gaps

- Reports:
  - API creates `ExportJob` then uses async `InvokeCommand` on the report Lambda.
  - No SQS report source queue, DLQ, redrive policy, event source mapping, or queue alarms.
  - Report Lambda accepts a single `{ exportJobId }` event.
  - Lambda catches errors and returns `{ status: "FAILED" }`; under SQS this would acknowledge poison work unless refactored.
  - No conditional processing claim or attempt/lease fields exist.
- Import recovery:
  - Current “DLQ” is a database query for failed import jobs plus a direct replay Lambda invocation.
  - `dlq-replay` resets rows/status before starting Step Functions and has no bounded replay/audit model.
  - Step Functions has `Catch` but no `Retry`.
  - The fail-handler state ends successfully, so caught failures can make the execution finish `SUCCEEDED`.
  - Approval callback has no timeout.
  - API reads call `recoverStaleJob`, so observation can mutate state.
  - No EventBridge terminal status rule, Import Recovery Queue, or persisted recovery item exists.
- Notifications:
  - Terraform creates the SNS topic but no subscription.
  - The public callback auto-fetches any provided `SubscribeURL`, does not verify SNS signatures/topic, returns HTTP 200 for processing failures, and accepts direct JSON in production.
  - Notification records have no source message deduplication key.
- IaC:
  - Terraform already contains the base serverless stack.
  - Local state is documented as intentionally empty after destroy.
  - Documentation conflicts about whether the old SAM stack still exists; AWS must be queried.
  - `apps/lambdas/template.yaml` remains a deployable second definition.

## Official AWS references used

- Lambda with SQS configuration and partial batch responses:
  - https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-configure.html
  - https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html
- SQS/Lambda visibility timeout guidance:
  - https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-configure-lambda-function-trigger.html
- Step Functions retry/catch/jitter:
  - https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html
- Step Functions events through EventBridge:
  - https://docs.aws.amazon.com/step-functions/latest/dg/eventbridge-integration.html
- EventBridge target DLQ semantics:
  - https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-rule-dlq.html
- SQS DLQ redrive and API:
  - https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-configure-dead-letter-queue-redrive.html
  - https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_StartMessageMoveTask.html
