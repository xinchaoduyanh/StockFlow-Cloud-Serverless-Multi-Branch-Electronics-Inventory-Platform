# Phase 06: Package Cost, Rollback, Documentation and Portfolio Evidence

## Objective

- Deliver a reviewer-ready E4 package and leave the environment in a known, recoverable cost state.

## Preconditions

- Phases 01–05 pass and evidence links are available.
- Demo credentials and publication policy are confirmed.

## Tasks

1. Write the demo script for a 3–5 minute walkthrough: role login, branch isolation, import, approval/completion, report, controlled failure, recovery, and dashboard signal.
2. Update architecture diagrams to match the actual Terraform/E3 topology, including report queue/DLQ, import recovery queue, telemetry path, and dashboard/alarms.
3. Update `README.md`, API/Lambda/infrastructure docs, `docs/README.md`, feature-rebuild checklists, and terminology; remove stale direct-Lambda/SAM claims once E3 parity is proven.
4. Write a cost breakdown for always-on demo, active demo window, and `system_on=false`; list unavoidable storage/secrets/log/CloudFront costs and assumptions.
5. Write rollback/off procedure: stop traffic, disable event mappings/schedules, preserve queues/messages, switch API mode only if safe, roll back application, and destroy only approved demo resources.
6. Capture sanitized screenshots of dashboard, Step Functions execution, role behavior, import result, report download, recovery audit, and benchmark report.
7. Record the video only after the flow is deterministic; do not show secrets or private user data.
8. Add CV/portfolio bullets that cite measured benchmark/availability/recovery outcomes and explicitly omit unmeasured claims.
9. Run final artifact/secret/state scan, `git diff --check`, and a consistency review across code, Terraform, diagrams, and docs.

## Verification

- Commands/checks:
  - `npm run lint`
  - `npm test -- --runInBand`
  - `npm run build`
  - `npm run build:lambdas`
  - `terraform fmt -check -recursive`
  - `terraform validate`
  - `git diff --check`
  - secret/state/artifact scan over tracked files
  - execute documented teardown and verify expected AWS resources/cost-bearing services
- Expected results:
  - A reviewer can follow the demo without hidden console steps.
  - Docs and diagrams use the same resource names and statuses as the deployed system.
  - The environment is either intentionally available with budget monitoring or demonstrably off.

## Exit Criteria

- [ ] Demo guide, benchmark report, cost story, rollback/off runbook, and architecture assets are complete.
- [ ] Video and screenshots contain no secrets/private data.
- [ ] Final quality and IaC gates pass.
- [ ] E4 backlog items are marked complete only with linked evidence.

