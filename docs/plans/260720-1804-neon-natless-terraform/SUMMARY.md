# Implementation Plan: Neon PostgreSQL and NAT-less Terraform

> Created: 2026-07-20 18:04:48 +0700
> Status: Draft

## Objective

- Replace Terraform-owned Aurora PostgreSQL with Neon PostgreSQL connection inputs.
- Remove NAT Gateway and private-subnet dependencies from the runtime architecture.
- Make `system_on=false` stop all meaningful runtime activity and remove hourly ALB/Fargate resources while retaining low-cost storage and serverless definitions.
- Keep this implementation code-only until an explicit, separately reviewed AWS apply.

## Scope

### In scope

- Neon pooled runtime URL and direct migration URL supplied as sensitive Terraform inputs.
- Secrets Manager-backed ECS configuration and the existing Lambda `DATABASE_URL` contract.
- Fargate tasks in public subnets with public IPs and inbound access restricted to the ALB security group.
- Lambdas outside the VPC with CloudWatch logging permissions preserved.
- Removal of Aurora, NAT Gateway, EIP, private subnets, private routing, and unused database/Lambda security groups.
- Conditional ALB/ECS service creation and conditional background event processing.
- Output, seed script, infrastructure documentation, and cost/off-runbook updates.

### Out of scope

- Running `terraform apply`, `terraform destroy`, or creating/changing any AWS resource.
- Creating the Neon project/database.
- Migrating production data from Aurora or another PostgreSQL database.
- Replacing Fargate/ALB with Lambda, App Runner, or another API platform.
- Introducing Terraform remote state or a new CI/CD pipeline.

## Architecture & Approach

1. Use Neon’s pooled connection string as `DATABASE_URL` for ECS and all Lambdas. Require TLS and retain the existing Lambda-safe pool limit.
2. Use Neon’s direct connection string as `DIRECT_URL` for Prisma migration tooling, and add `directUrl` to the Prisma datasource.
3. Preserve Terraform-managed Secrets Manager metadata/version resources for compatibility. Sensitive Terraform variables and generated state must be handled as secrets; remove the raw `database_url` output.
4. Place Fargate in the two existing public subnets with `assign_public_ip = true`. The API security group continues to allow ingress only from the ALB security group.
5. Remove Lambda `vpc_config`. Replace `AWSLambdaVPCAccessExecutionRole` with `AWSLambdaBasicExecutionRole` so functions retain CloudWatch Logs access.
6. Remove private subnets, private routes, NAT Gateway/EIP, database security group, and Lambda security group because no deployed runtime remains private.
7. Give ALB, its target group/listeners, and the ECS service `count = var.system_on ? 1 : 0`. Keep the ECS cluster/task definition/ECR repository because those have no hourly runtime charge.
8. Set both SQS event source mappings and all four EventBridge rules to disabled while `system_on=false`. The off runbook must drain or stop in-flight workflows before switching off.
9. Keep CloudFront/S3, Lambda definitions, SQS queues, Step Functions, SNS, IAM, CloudWatch alarms, and ACM lookups provisioned because their idle cost is zero or minimal.

## Phases

- [ ] **Phase 1: Replace Aurora with Neon inputs** — Goal: remove RDS ownership and provide safe pooled/direct database configuration.
- [ ] **Phase 2: Remove NAT and VPC runtime coupling** — Goal: give ECS and Lambda internet egress without NAT while preserving inbound isolation and logging.
- [ ] **Phase 3: Complete the runtime on/off switch** — Goal: remove hourly ALB/Fargate resources and disable event processing when off.
- [ ] **Phase 4: Verify, document, and review the saved plan** — Goal: prove the Terraform graph and operational runbook match the intended cost model without applying it.

## Key Changes

- `infrastructure/terraform/variable.tf`
  - Add sensitive pooled/direct Neon URL variables.
  - Update `system_on` semantics.
- `infrastructure/terraform/database.tf`
  - Remove Aurora/password/subnet resources.
  - Store pooled and direct Neon URLs in Secrets Manager.
- `apps/api/prisma/schema.prisma`
  - Add `directUrl = env("DIRECT_URL")`.
- `infrastructure/terraform/network.tf`
  - Remove NAT/EIP/private subnets/private routing and unused SGs.
- `infrastructure/terraform/ecs.tf`
  - Inject both database secrets, use public subnets/public IP, and conditionally create the ECS service.
- `infrastructure/terraform/alb.tf`
  - Conditionally create the ALB, target group, and listeners.
- `infrastructure/terraform/serverless.tf`
  - Remove Lambda VPC attachment, preserve basic logging, inject pooled URL, and disable triggers when off.
- `infrastructure/terraform/outputs.tf`
  - Remove Aurora/raw URL outputs, add public subnet output, and make ALB output nullable while off.
- `infrastructure/terraform/seed-db.ps1`
  - Run one-off migration/seed tasks in public subnets with public IP enabled.
- `infrastructure/TERRAFORM_PLAN.md` and deployment documentation
  - Replace Aurora/private-NAT claims and document Neon, costs, on/off behavior, and DNS implications.

## Verification Strategy

- Static:
  - `terraform fmt -check -recursive`
  - `terraform validate`
  - `rg -n "aws_nat_gateway|aws_eip|aws_rds_|aurora|private_subnet_ids|AWSLambdaVPCAccessExecutionRole" infrastructure/terraform`
- Application:
  - `npm run prisma:format --workspace apps/api` or repository-equivalent Prisma format command.
  - `npm run prisma:generate --workspace apps/api`
  - `npm run build`
  - `npm run build:lambdas`
  - `npm test -- --runInBand`
- Terraform plans, never apply:
  - Off plan with `system_on=false`: no RDS/NAT/ALB/ECS service; mappings/rules disabled.
  - On plan with `system_on=true`: ALB and one ECS service/task desired; still no RDS/NAT/private runtime resources.
  - Review every destroy/replacement before any later apply.
- Manual cloud checks are deferred until separately authorized:
  - Neon TLS connectivity, migrations, seed, Lambda DB access, ALB health, DNS, and off-state billing inventory.

## Dependencies

- Terraform CLI compatible with the existing lockfile; it is currently unavailable in this workspace environment.
- Two Neon URLs:
  - pooled runtime URL with TLS and Lambda-safe connection parameters;
  - direct URL for Prisma migrations.
- Existing issued ACM certificates for `api.vuduyanh.id.vn` and `app.vuduyanh.id.vn`.
- A DNS update path for `api.vuduyanh.id.vn`, because recreating the ALB changes its DNS name.

## Risks & Mitigations

- Sensitive URLs enter Terraform state → keep state and tfvars untracked, remove raw URL outputs, mark variables/outputs sensitive, and document remote encrypted state as follow-up hardening.
- Public Fargate IP appears internet-facing → API SG accepts port 3000 only from the ALB SG; no internet CIDR ingress is added.
- Lambda loses logging after leaving VPC → replace the VPC execution policy with the basic Lambda execution policy before removing `vpc_config`.
- Neon connection exhaustion → use the pooled URL for runtime and retain `pgbouncer=true&connection_limit=1` where supported.
- Prisma migrations through a pooler can fail → inject a separate direct Neon URL and use Prisma `directUrl`.
- ALB DNS changes after off/on → make output nullable, document the update, and do not claim seamless DNS unless Route53 is later brought into scope.
- Switching off during active workflows can lose terminal/recovery events → off runbook must stop new uploads, drain queues, and verify no running Step Functions executions first.
- Existing deployed Aurora/NAT resources would be destroyed by a future apply → require a reviewed saved plan and explicit cloud authorization before apply.

## Open Questions

- Confirm the Neon project uses the pooled endpoint for runtime and provides a separate direct endpoint for migration.
- Confirm whether `api.vuduyanh.id.vn` DNS is managed manually or by a provider that can automate ALB CNAME updates.
- Confirm any existing Aurora data can be discarded; data migration is explicitly not included.

## Handoff

Plan `docs/plans/260720-1804-neon-natless-terraform/SUMMARY.md` is ready.
Use `/clear` and then `/execute-plan docs/plans/260720-1804-neon-natless-terraform/SUMMARY.md` after confirming the open questions.
