# Phase 08: Integrate the Recovery Console and Prove E3

## Objective

- Deliver the targeted admin UX, end-to-end evidence, documentation, and safe rollout/rollback.

## Preconditions

- Phases 1-7 pass local verification.
- AWS smoke tests are authorized and TF-2 through TF-4 are operational.

## Tasks

1. Extract only recovery-related UI/API hooks from `apps/web/src/app/dashboard/page.tsx` into `apps/web/src/features/recovery/`.
2. Rename the admin tab from “DLQ” to “Khôi phục sự cố”.
3. Show separate report and import recovery tables with safe error, attempts, timestamps, and state.
4. Show aggregate source queue/DLQ metrics without raw payloads.
5. Require a reason dialog for replay/discard and display max-attempt warnings.
6. Add report retry/download state refresh and import replacement-execution status refresh.
7. Preserve ADMIN-only navigation while relying on backend authorization as the security boundary.
8. Run full local lint/test/build/Lambda/Terraform gates.
9. Create and review a saved Terraform plan for E3 additions; reject unexpected destroy/replace.
10. Apply database migration before enabling new event source mappings.
11. Deploy queues/Lambdas/mappings before switching the API report dispatcher to SQS.
12. Confirm Lambda event source mappings are enabled and alarms have expected initial state.
13. Smoke-test a successful report and verify exactly one S3 object/database completion.
14. Inject a retryable report failure and verify receive count, failed database state, DLQ message, alarm, and audited redrive.
15. Redrive the same report twice and verify idempotent completion.
16. Inject a transient import task failure and verify bounded Step Functions retries.
17. Inject a validation failure and verify no retry plus one terminal recovery item.
18. Test approval timeout in a staging configuration with a short timeout, then restore the production value.
19. Replay and discard import recovery items and verify actor/reason/history.
20. Force an SNS callback processing failure and verify retry/delivery-DLQ behavior; then verify deduplication.
21. Document rollback order: disable mappings, restore API dispatch mode, retain queues/messages, roll back application, and only then consider schema rollback.
22. Update `README.md`, `apps/api/README.md`, `apps/lambdas/README.md`, `infrastructure/README.md`, `infrastructure/TERRAFORM_PLAN.md`, architecture diagrams, and terminology.
23. Update E2/E3 checklists only with linked command/cloud evidence.
24. Record known cost-bearing resources and destroy/off procedure for the demo environment.
25. Run `git diff --check` and a final secret/state/artifact scan before commit.

## Verification

- Commands:
  - `npm run lint`
  - `npm test -- --runInBand`
  - `npm --workspace apps/api run test:postgres`
  - `npm run build`
  - `npm run build:lambdas`
  - `terraform fmt -check -recursive`
  - `terraform validate`
  - `terraform plan -out=e3.plan`
  - `terraform show e3.plan`
  - `git diff --check`
  - `git status --short`
- Expected results:
  - Report API never directly invokes the exporter Lambda.
  - Exhausted report failures arrive in a real DLQ and redrive is idempotent.
  - Import retries, timeout, terminal recovery, replay, and discard have evidence.
  - Notification subscription and failure recovery are reproducible from IaC.
  - README, diagrams, API behavior, and Terraform use the same queue/DLQ/recovery terms.

## Exit Criteria

- [ ] Every FR-3 acceptance criterion has local and/or cloud evidence.
- [ ] Full quality gates pass.
- [ ] Saved plan and rollout/rollback evidence are retained without committing state or secrets.
- [ ] E3 backlog items are marked complete only after cloud smoke tests.
