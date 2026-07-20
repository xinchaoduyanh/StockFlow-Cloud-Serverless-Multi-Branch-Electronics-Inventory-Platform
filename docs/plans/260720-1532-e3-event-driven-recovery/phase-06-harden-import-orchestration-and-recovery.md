# Phase 06: Harden Import Orchestration and Recovery

## Objective

- Make import retry semantics explicit and persist all terminal cloud failures for bounded recovery.

## Preconditions

- Phase 3 recovery schema/contracts exist.
- Terraform owns the active Step Functions and Lambda resources.

## Tasks

1. Define shared non-retryable business errors and retryable infrastructure errors.
2. Update validator/parser/writer/token-register Lambdas to throw infrastructure failures instead of returning fake success objects.
3. Keep validation/business rejections as structured non-retryable outputs.
4. Pass `$$.Execution.Id` and explicit execution context into the workflow tasks.
5. Persist execution ARN on `ImportJob` as soon as the job is correlated.
6. Add Step Functions `Retry` blocks for transient Lambda/AWS/network/database failures with exponential backoff and full jitter.
7. Route validation/business failures directly to the terminal handler without retry.
8. Add `TimeoutSeconds` to the approval callback state; proposed production default is 24 hours.
9. Capture failure details with `ResultPath` and sanitize them in `import-job-fail-handler`.
10. Make fail-handler database update failures throw; keep notification publish failures isolated/logged.
11. Transition from fail-handler to an explicit `Fail` state so the execution status is actually `FAILED`.
12. Add an EventBridge rule for Step Functions `FAILED`, `TIMED_OUT`, and `ABORTED` execution status changes.
13. Add `import-recovery` SQS and a transport DLQ with encryption, retention, queue policy, and alarms.
14. Replace `apps/lambdas/dlq-replay/index.ts` with `apps/lambdas/import-recovery-worker/index.ts`.
15. Let the worker consume terminal events, correlate by execution ARN/input key/import job ID, and upsert one `ImportRecoveryItem`.
16. Return partial batch failures when persistence/correlation is temporarily unavailable.
17. Invoke the same worker on a schedule to find stale non-terminal jobs missed by normal orchestration.
18. Use thresholds per status; never expire an approval job earlier than the Step Functions approval timeout plus buffer.
19. Remove `recoverStaleJob` mutation from API read paths.
20. Add ADMIN recovery endpoints for import replay/discard with required reason and a proposed maximum of three replays.
21. Persist a replay attempt before dispatch and use a deterministic Step Functions execution name for that attempt.
22. Start replay through the API's `SFNClient`, reset only replay-safe job/row state, and compensate the attempt record on dispatch failure.
23. Mark the recovery item resolved only after a replacement execution succeeds; keep prior execution history.
24. Discard by updating the recovery item and import status without deleting audit/history.
25. Update ECS task IAM/environment for `states:StartExecution`; remove direct `DLQ_REPLAY_LAMBDA_ARN`.
26. Remove `dlq-replay` from esbuild/Terraform and add `import-recovery-worker`.
27. Delete the deployable SAM template after a final parity diff, or move only non-deployable reference material into documentation.
28. Add unit/database tests for retry taxonomy, terminal status, timeout, duplicate terminal event, correlation fallback, replay bound/idempotency, stale scan, and discard audit.

## Verification

- Commands:
  - `npm test -- --runInBand`
  - `npm --workspace apps/api run test:postgres`
  - `npm run build:lambdas`
  - `terraform fmt -check -recursive`
  - `terraform validate`
  - `rg -n "dlq-replay|DLQ_REPLAY_LAMBDA_ARN|recoverStaleJob" apps infrastructure`
- Expected results:
  - Transient errors retry with backoff/jitter; business validation does not retry.
  - Fail-handler paths end in a terminal failed execution.
  - Every terminal execution produces at most one open recovery item.
  - Replay creates a new bounded execution and cannot double-reset or double-commit inventory.
  - API reads no longer mutate stale jobs.

## Exit Criteria

- [ ] E3-06, E3-07, E3-08, and E3-10 are implemented.
- [ ] Import Recovery Queue is named/documented as a recovery queue, not a DLQ.
- [ ] The old replay Lambda and deployable SAM ownership path are removed.
