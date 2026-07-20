# Phase 02: Audit Terraform Ownership

## Objective

- Prove Terraform is the only production owner and establish a safe base-state/apply sequence.

## Preconditions

- Terraform CLI `>= 1.7` and AWS CLI are installed.
- The operator has authenticated to the intended sandbox account/region.
- No `terraform apply` is authorized by this audit phase.

## Tasks

1. Confirm AWS account and region with `aws sts get-caller-identity` and configured region output.
2. Run `terraform init -backend=false` if provider initialization is needed for validation only.
3. Run `terraform state list` against the official state and record that state location.
4. Verify the reported empty state is intentional and do not restore a backup state.
5. Query CloudFormation for `stockflow-pipeline`; record absent/present rather than trusting older docs.
6. Inventory resources tagged `Project=stockflow` across S3, Lambda, Step Functions, SQS, SNS, EventBridge, ECS, ALB, and CloudFront.
7. Verify the orphan CloudFront distribution `E2L4RUB4YKMQ6A` and its aliases without deleting it.
8. Fill the code/state/AWS/owner/action table in `plans/feature-rebuild/terraform-audit-checklist.md`.
9. Compare `apps/lambdas/template.yaml` with `infrastructure/terraform/serverless.tf` and list parity gaps.
10. Choose recreate versus import for each existing resource; default to recreate for the intentionally destroyed demo stack.
11. Write a migration/rollback runbook for removing the deployable SAM template after Terraform parity.
12. Run `terraform fmt -check -recursive` and `terraform validate`.
13. Produce a saved plan for TF-2 through TF-4 only when required variables and Lambda artifacts are available.
14. Review create/change/destroy counts and reject any unexpected deletion or replacement.
15. Smoke-test TF-2 network, TF-3 database/migration, and TF-4 serverless base before planning E3 additions.

## Verification

- Commands:
  - `aws sts get-caller-identity`
  - `aws cloudformation describe-stacks --stack-name stockflow-pipeline`
  - `terraform state list`
  - `terraform fmt -check -recursive`
  - `terraform validate`
  - `terraform plan -out=tf2-tf4.plan`
  - `terraform show tf2-tf4.plan`
- Expected results:
  - The official state and AWS account are unambiguous.
  - No production logical resource has both SAM and Terraform ownership.
  - The saved plan contains no unexplained destroy/replace action.
  - TF-2 through TF-4 are operational before E3 cloud resources are applied.

## Exit Criteria

- [ ] Ownership matrix and rollback runbook are complete.
- [ ] Terraform format and validation pass.
- [ ] TF-2 through TF-4 have smoke-test evidence, or cloud execution is explicitly marked blocked while code-only phases continue.
- [ ] The SAM template has a documented decommission point.
