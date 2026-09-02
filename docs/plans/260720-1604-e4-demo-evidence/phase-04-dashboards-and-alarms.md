# Phase 04: Add Dashboards and Actionable Alarms

## Objective

- Give the demo a small, readable operational view that detects failures a reviewer can intentionally reproduce.

## Preconditions

- Phase 01 Terraform ownership and Phase 03 log/metric names are stable.
- Alarm notification destination and budget policy are approved.

## Tasks

1. Add Terraform resources for a CloudWatch dashboard covering ALB/API latency and 5xx, ECS task health/log volume, Lambda duration/errors/throttles, Step Functions failed/timed-out/aborted executions, SQS age/depth, DLQ depth, and Aurora connections/health.
2. Add alarms with explicit thresholds and evaluation periods for API 5xx, Lambda errors/throttles, Step Functions failure, source queue age, report/import DLQ depth, and database connection pressure.
3. Make notification destination configurable; do not hard-code a personal email or reuse business notification topics without documenting the separation.
4. Add alarm descriptions with runbook links and a clear remediation: inspect correlation ID, replay only with a reason, drain/disable mapping, or tear down demo.
5. Create controlled failure fixtures for one API 5xx, one Lambda error/throttle signal, one Step Functions terminal failure, and one DLQ message.
6. Capture dashboard/alarms before and after failure, then clear the condition and verify recovery state.
7. Add Terraform outputs and a short `docs/demo/observability.md` guide with metric namespaces, dimensions, thresholds, and evidence timestamps.

## Verification

- Commands:
  - `terraform fmt -check -recursive`
  - `terraform validate`
  - `terraform plan -out=e4-observability.plan`
- Manual checks:
  - Verify each alarm enters ALARM only for its intended signal.
  - Verify DLQ alarm and recovery action use the real E3 queue, not a failure list.
  - Verify dashboard links resolve in the demo account and no secret/raw payload is displayed.

## Exit Criteria

- [ ] Dashboard is provisioned from Terraform and covers the agreed signals.
- [ ] Each alarm has threshold, action, runbook, and evidence.
- [ ] At least one controlled failure is detected and cleared.
- [ ] Alarm resources and notification costs are included in the cost story.
