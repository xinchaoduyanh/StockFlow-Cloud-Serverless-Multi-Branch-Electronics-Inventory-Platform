# Phase 04: Build the Report Queue Pipeline

## Objective

- Replace direct report Lambda invocation with an idempotent SQS consumer and real report DLQ.

## Preconditions

- Phase 3 migration is available to API and Lambda builds.
- Production queue defaults are approved.

## Tasks

1. Add a `ReportDispatcher` boundary under `apps/api/src/reports/`.
2. Implement an SQS dispatcher that sends only `{ version, exportJobId }`.
3. Keep local synchronous dispatch behind explicit `REPORT_DISPATCH_MODE=local` and reject that mode in production.
4. Update `ReportsService.createExport` to create `PENDING`, send the message, and mark/return a safe dispatch failure if SQS send fails.
5. Remove `LambdaClient`, `InvokeCommand`, and `REPORT_EXPORTER_LAMBDA_ARN` from report API code and production environment.
6. Refactor report generation into testable functions shared by the SQS handler path.
7. Type the Lambda entry point as `SQSHandler` and validate message version/resource ID.
8. Implement a conditional database claim for `PENDING` or expired `PROCESSING` jobs.
9. Return success immediately for `COMPLETED` or `DISCARDED` jobs and for an active claim held by another invocation.
10. Increment `attemptCount` and set `processingStartedAt` atomically when claiming.
11. Use a deterministic S3 key based on `exportJobId` so a retry overwrites/settles the same logical artifact.
12. On success, update `COMPLETED` only from the current processing claim.
13. On failure, persist a safe error code/message, reset retryable work, and include the record in `batchItemFailures`.
14. Use `ApproximateReceiveCount` to mark the job `FAILED` on the final configured delivery while still failing the SQS record.
15. Remove unconditional per-invocation Prisma disconnect from the warm Lambda path.
16. Add report queue and report DLQ Terraform resources with encryption, retention, redrive policy, and redrive allow policy.
17. Set visibility timeout to at least six times the Lambda timeout plus any batch window; proposed values are `120s` and `900s`.
18. Add Lambda event source mapping with a small batch size and `ReportBatchItemFailures`.
19. Add least-privilege Lambda SQS receive/delete/get-attributes IAM and API `sqs:SendMessage` IAM.
20. Add queue URL to ECS environment and remove API permission to invoke the report Lambda.
21. Add CloudWatch alarms for DLQ visible messages and source queue oldest-message age.
22. Add unit tests for duplicate delivery, concurrent claim, stale claim, partial batch, final receive, deterministic S3 key, and dispatch failure.

## Verification

- Commands:
  - `npm test -- --runInBand`
  - `npm --workspace apps/api run test:postgres`
  - `npm run build`
  - `npm run build:lambdas`
  - `terraform fmt -check -recursive`
  - `terraform validate`
- Expected results:
  - No report API code imports `@aws-sdk/client-lambda`.
  - A duplicate message cannot create a duplicate export artifact or repeat a completed job.
  - One failed record does not retry successful records from the same batch.
  - Exhausted failures move to the configured report DLQ and the database job is `FAILED`.

## Exit Criteria

- [ ] E3-02, E3-03, and E3-04 are complete in code and tests.
- [ ] Queue timeouts/redrive/IAM satisfy AWS guidance.
- [ ] Report API production configuration contains only the queue URL.
