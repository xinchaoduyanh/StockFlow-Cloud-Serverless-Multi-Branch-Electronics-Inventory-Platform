# Phase 03: Complete the Runtime System Switch

## Objective

- Make `system_on=false` remove hourly ALB/Fargate runtime resources and stop asynchronous processing.

## Preconditions

- Phase 02 networking is stable.
- Operators accept that recreating the ALB changes its AWS DNS name.

## Tasks

1. In `infrastructure/terraform/alb.tf`, add `count = var.system_on ? 1 : 0` to the ALB, target group, HTTPS listener, and HTTP listener.
2. Update all counted ALB/target/listener references to indexed references.
3. In `infrastructure/terraform/ecs.tf`, conditionally create the ECS service rather than keeping an empty service; retain cluster/task definition/ECR.
4. Set the service desired count to one when present and update its load balancer/dependency references.
5. In `infrastructure/terraform/serverless.tf`, set both SQS event source mappings’ `enabled` values from `var.system_on`.
6. Set all four EventBridge rules (`s3_upload`, `ingestion_terminal`, `reconciliation`, `import_recovery_scan`) to `ENABLED` or `DISABLED` from `var.system_on`.
7. Make `alb_dns_name` nullable with `try(...)` while off and clearly describe the DNS recreation behavior.
8. Add an off-order runbook: stop uploads, wait for running Step Functions executions, inspect/drain source queues, apply `system_on=false`, and verify no ALB/ECS task/event trigger remains active.

## Verification

- Commands:
  - `terraform plan -var-file=<ignored-neon-vars> -var="system_on=false" -out=neon-off.plan`
  - `terraform show -no-color neon-off.plan`
  - `terraform plan -var-file=<ignored-neon-vars> -var="system_on=true" -out=neon-on.plan`
  - `terraform show -no-color neon-on.plan`
- Expected off plan:
  - Zero ALB/listener/target group/ECS service resources.
  - Event source mappings and EventBridge rules disabled.
  - No RDS, NAT, or private runtime resources.
- Expected on plan:
  - One ALB, target group, HTTP/HTTPS listeners, and ECS service with one desired task.
  - Event source mappings and rules enabled.
  - No RDS or NAT resources.

## Exit Criteria

- [ ] `system_on=false` removes all hourly ALB/Fargate runtime resources.
- [ ] `system_on=false` disables background event processing.
- [ ] `system_on=true` restores the intended API and worker graph.
- [ ] Nullable output and DNS recreation are documented.
- [ ] Off procedure protects in-flight workflow/recovery state.
