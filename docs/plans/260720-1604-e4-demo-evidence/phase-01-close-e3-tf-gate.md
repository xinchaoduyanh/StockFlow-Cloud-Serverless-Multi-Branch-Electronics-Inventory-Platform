# Phase 01: Close E3 and Terraform Entry Gate

## Objective

- Establish that the E3 runtime, Terraform ownership, and quality baseline are real and deployable before E4 data, telemetry, or benchmark work begins.

## Preconditions

- E3 persistence/contracts migration is reviewed and can be applied to a disposable database.
- AWS account, Terraform CLI, and approved demo budget are available.
- No production/demo apply is attempted from the current unverified local state.

## Tasks

1. Reconcile the E3 checklist against code and mark only the persistence/contracts work as complete until runtime/cloud evidence exists.
2. Finish the report SQS producer/consumer/DLQ path, conditional claims, deterministic artifact key, partial-batch failure behavior, and queue alarms.
3. Finish Step Functions retry taxonomy, approval timeout, terminal failure event, import recovery worker, bounded audited replay/discard, and stale-job scheduler.
4. Finish Terraform ownership migration: replace old direct Lambda/IAM references, add all E3 queues/mappings/rules/subscriptions, and remove the deployable SAM ownership path after parity review.
5. Make the root lint gate ignore generated `.aws-sam`, `dist`, build, and temporary output directories; run scoped lint over tracked source and fix remaining errors that block CI.
6. Run Prisma format/generate, unit tests, PostgreSQL integration tests with `RUN_POSTGRES_TESTS=1`, application build, Lambda build, and Terraform fmt/validate.
7. Save a reviewed Terraform plan and record unexpected replacement/destroy findings, ownership decisions, and rollback order in the E3 evidence note.

## Verification

- Commands:
  - `npm test -- --runInBand`
  - `RUN_POSTGRES_TESTS=1 npm --workspace apps/api run test:postgres`
  - `npm run build`
  - `npm run build:lambdas`
  - `npm run lint`
  - `terraform fmt -check -recursive`
  - `terraform validate`
  - `terraform plan -out=e3.plan` followed by `terraform show e3.plan`
  - `rg -n "LambdaClient|InvokeCommand|REPORT_EXPORTER_LAMBDA_ARN|dlq-replay|DLQ_REPLAY_LAMBDA_ARN|recoverStaleJob" apps infrastructure`
- Expected results:
  - No E3 production path invokes report/recovery Lambdas directly from the API.
  - E3 queues, consumers, alarms, and IAM are visible in the reviewed Terraform plan.
  - Lint scans source only and passes with zero errors/warnings under the repository policy.
  - Cloud acceptance evidence exists for successful and failed report/import/recovery/notification paths.

## Exit Criteria

- [ ] E3 runtime items are implemented and tested.
- [ ] Terraform is the only active owner of affected resources.
- [ ] All local quality gates pass.
- [ ] Saved plan has no unexplained destroy/replace.
- [ ] E3 cloud smoke evidence is linked from the plan.

