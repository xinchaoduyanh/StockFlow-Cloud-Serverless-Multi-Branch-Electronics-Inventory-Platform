# Phase 04: Verify and Document

## Objective

- Validate the NAT-less Neon graph, update operational documentation, and prepare a reviewed plan without changing AWS.

## Preconditions

- Phases 01–03 are complete.
- Terraform CLI is installed and provider initialization is available.

## Tasks

1. Update `infrastructure/TERRAFORM_PLAN.md` and relevant README sections to replace Aurora/private-NAT claims with the deployed Neon/public-egress design.
2. Document required Neon URL formats, ignored tfvars/`TF_VAR_*` handling, Terraform-state sensitivity, and secret rotation/restart behavior.
3. Document the monthly cost story:
   - off: Secrets Manager plus small S3/ECR storage;
   - on: ALB, Fargate, and public IPv4 for active hours;
   - no NAT or Aurora line item.
4. Document ALB DNS updates after off/on and explicitly avoid claiming zero-downtime restart.
5. Run source quality gates, Prisma generation, application/Lambda builds, and Terraform format/validate.
6. Produce saved off/on plans and review all destroy/replacement actions; do not apply either plan.
7. Scan tracked files and the diff for Neon hostnames, credentials, tfvars, Terraform state, and plan binaries.

## Verification

- Commands:
  - `npm test -- --runInBand`
  - `npm run build`
  - `npm run build:lambdas`
  - `npm run lint`
  - `terraform init`
  - `terraform fmt -check -recursive`
  - `terraform validate`
  - off/on saved plans from Phase 03
  - `git diff --check`
  - `git status --short`
- Expected results:
  - Tests/builds and Terraform checks pass.
  - Saved plans contain only explained removals/replacements.
  - No AWS apply/destroy occurs.
  - No secret, state, tfvars, or binary plan is tracked.

## Exit Criteria

- [ ] Code, Terraform, scripts, and documentation describe one consistent architecture.
- [ ] Quality gates pass or pre-existing failures are clearly separated.
- [ ] Off/on plans are reviewed and contain no unexplained resource actions.
- [ ] Secret/state scan passes.
- [ ] AWS remains unchanged pending explicit apply authorization.
