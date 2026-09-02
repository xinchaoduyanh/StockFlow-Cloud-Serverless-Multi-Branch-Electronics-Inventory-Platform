# Phase 02: Build the Demo Environment and Personas

## Objective

- Provide a cost-controlled Terraform environment with realistic multi-branch data and three safe demo personas that exercise distinct permissions.

## Preconditions

- Phase 01 exit criteria pass.
- Demo hostname, budget, and temporary credential policy are approved.

## Tasks

1. Add a demo deployment runbook that records account, region, Terraform variables, `system_on`, migration order, E3 queue readiness, and teardown order.
2. Update `infrastructure/terraform/seed-db.ps1` or add a dedicated `scripts/demo/seed-demo` command so seed/reset behavior is explicit, idempotent, and scoped to demo data.
3. Remove personal-looking identities, fixed Cognito subjects, and password `123` from the deployable demo path; source demo user configuration from ignored environment input and provision matching Cognito users safely.
4. Seed at least three branches, inventory with normal/low/reserved stock, transfer history, valid/invalid imports, completed/failed reports, and recovery records that are safe to display.
5. Add a reset command that removes demo transactional data, re-seeds deterministic fixtures, and does not silently destroy unrelated account data.
6. Verify ADMIN, WAREHOUSE, and STORE_MANAGER journeys, including a denied cross-branch read/write and an allowed branch-scoped operation.
7. Add a dashboard/demo guide with exact login, import, report, recovery, and branch-isolation steps; keep credentials out of the guide if they are not intended for public viewing.

## Verification

- Commands/checks:
  - Terraform apply with an explicit demo variable file kept outside Git.
  - ECS one-off migration and seed task through `infrastructure/terraform/seed-db.ps1` or replacement.
  - Run seed twice and compare counts/checksums for idempotency.
  - Execute reset, re-seed, and verify only the documented demo scope changes.
  - Browser/API walkthrough for all three roles and a forbidden cross-branch request.
- Expected results:
  - A fresh demo can be rebuilt from Terraform plus documented commands.
  - Each role shows a meaningful, different flow and backend authorization is enforced.
  - No personal credential, secret, state file, or raw customer data is committed.

## Exit Criteria

- [ ] Demo environment deploys and tears down through the runbook.
- [ ] Three personas and branch-isolation evidence are captured.
- [ ] Seed/reset is deterministic, parameterized, and safe.
- [ ] `system_on=false` procedure is tested and its remaining costs are recorded.
