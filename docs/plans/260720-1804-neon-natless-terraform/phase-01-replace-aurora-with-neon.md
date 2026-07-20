# Phase 01: Replace Aurora with Neon

## Objective

- Remove Terraform-owned Aurora resources and provide separate pooled/runtime and direct/migration Neon connection paths.

## Preconditions

- Neon pooled and direct PostgreSQL URLs are available but not committed to Git.
- Any required Aurora data migration has been completed separately or explicitly waived.

## Tasks

1. In `infrastructure/terraform/variable.tf`, add sensitive `database_url` and `database_direct_url` variables with no defaults, and update the `system_on` description.
2. In `infrastructure/terraform/database.tf`, remove `random_password`, DB subnet group, RDS cluster, RDS instance, and Aurora-specific comments.
3. Retain Secrets Manager resources and store the pooled and direct URL values without exposing them in outputs.
4. In `apps/api/prisma/schema.prisma`, add `directUrl = env("DIRECT_URL")`.
5. In `infrastructure/terraform/ecs.tf`, grant the execution role access to both secrets and inject `DATABASE_URL` plus `DIRECT_URL`.
6. In `infrastructure/terraform/serverless.tf`, inject only the pooled URL as `DATABASE_URL`.
7. In `infrastructure/terraform/outputs.tf`, remove `aurora_endpoint` and the raw sensitive `database_url` output; retain ARN-only secret outputs.
8. Remove the unused `random` provider requirement and refresh the lockfile only through `terraform init` once Terraform is available.

## Verification

- Commands:
  - `npx prisma format --schema apps/api/prisma/schema.prisma`
  - `npm run prisma:generate --workspace apps/api`
  - `rg -n "aws_rds_|aurora|random_password" infrastructure/terraform`
  - `git diff --check`
- Expected results:
  - Prisma resolves pooled runtime and direct migration URL contracts.
  - No RDS/Aurora resource remains in the deployable Terraform graph.
  - No output prints a Neon credential.

## Exit Criteria

- [ ] Aurora and random password resources are removed.
- [ ] ECS receives pooled and direct URLs through Secrets Manager.
- [ ] Lambdas receive only the pooled URL.
- [ ] Prisma migration tooling uses the direct URL.
- [ ] Secret values remain absent from tracked files and normal Terraform outputs.
