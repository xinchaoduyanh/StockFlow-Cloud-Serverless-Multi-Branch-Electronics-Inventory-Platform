# Terraform ownership audit — E3

Captured 2026-07-20 after the E3 read-only cloud scout.

| Surface                                       | Repository owner                                | State          | AWS evidence                                                       | Action                                        |
| --------------------------------------------- | ----------------------------------------------- | -------------- | ------------------------------------------------------------------ | --------------------------------------------- |
| Lambda, SQS, Step Functions, EventBridge, SNS | `infrastructure/terraform`                      | No local state | No stockflow Lambda/SQS/SFN/SNS/EventBridge resources found        | Recreate only through Terraform               |
| Legacy SAM/CloudFormation                     | Removed deployable `apps/lambdas/template.yaml` | No stack       | `stockflow-pipeline` does not exist                                | Do not reintroduce SAM deploy                 |
| S3                                            | `infrastructure/terraform`                      | No local state | Existing unrelated buckets only                                    | Review bucket names before apply              |
| CloudFront                                    | `infrastructure/terraform`                      | No local state | Orphan distribution `E2L4RUB4YKMQ6A` owns `vuduyanh.id.vn` aliases | Resolve alias ownership before frontend apply |
| ECS/Aurora/network                            | `infrastructure/terraform`                      | No local state | No active stockflow service stack verified                         | Apply only after cost/rollout checkpoint      |

## Evidence commands

- `aws sts get-caller-identity` → account `186818869522`, IAM user `stockflowcloud`.
- `aws cloudformation describe-stacks --stack-name stockflow-pipeline` → stack does not exist.
- AWS tagged-resource scan found no stockflow Lambda/SFN/SQS/SNS/EventBridge resources.
- `/tmp/stockflow-e3.tfplan` → 128 creates, 0 changes, 0 destroys with `-refresh=false`.
- `terraform fmt -check -recursive` and `terraform validate` pass.

## Apply gate

No apply was run. Before apply, review CloudFront alias ownership, the cost-bearing NAT/Aurora/ECS resources, and the migration/deployment order in `docs/runbooks/e3-recovery.md`.
