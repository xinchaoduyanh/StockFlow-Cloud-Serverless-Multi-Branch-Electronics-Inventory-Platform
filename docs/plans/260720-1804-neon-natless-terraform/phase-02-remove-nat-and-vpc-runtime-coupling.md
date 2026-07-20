# Phase 02: Remove NAT and VPC Runtime Coupling

## Objective

- Remove the NAT Gateway and allow ECS/Lambda to reach Neon and AWS public endpoints without private-subnet egress infrastructure.

## Preconditions

- Phase 01 database contracts are complete.
- Neon accepts public TLS connections without requiring one fixed source IPv4 allowlist entry.

## Tasks

1. In `infrastructure/terraform/network.tf`, remove the NAT Gateway, NAT EIP, private route table/route/associations, and both private subnets.
2. Remove the database and Lambda security groups; retain ALB and API security groups.
3. Keep two public subnets, Internet Gateway, public route table, and S3 Gateway Endpoint; attach the endpoint only to the remaining public route table.
4. Verify the API security group still permits port 3000 only from the ALB security group and has outbound access for Neon/AWS APIs.
5. In `infrastructure/terraform/ecs.tf`, use both public subnets and set `assign_public_ip = true`.
6. In `infrastructure/terraform/serverless.tf`, remove every Lambda `vpc_config`.
7. Replace `AWSLambdaVPCAccessExecutionRole` attachments with `AWSLambdaBasicExecutionRole`; keep or adapt the IAM propagation dependency if Terraform still requires it.
8. In `infrastructure/terraform/outputs.tf`, replace `private_subnet_ids` with `public_subnet_ids`.
9. In `infrastructure/terraform/seed-db.ps1`, use public subnets and `assignPublicIp=ENABLED` for migration/seed tasks.

## Verification

- Commands:
  - `rg -n "aws_nat_gateway|aws_eip|private_subnet|private_to_nat|vpc_config|AWSLambdaVPCAccessExecutionRole" infrastructure/terraform`
  - `rg -n "0\\.0\\.0\\.0/0" infrastructure/terraform/network.tf`
  - `terraform fmt -check -recursive`
  - `terraform validate`
- Expected results:
  - No NAT, private subnet, private route, DB SG, Lambda SG, or Lambda VPC attachment remains.
  - Public ingress to container port 3000 is still SG-to-SG from ALB only.
  - Lambda roles retain CloudWatch Logs permissions.
  - Seed task requests a public IP.

## Exit Criteria

- [ ] Terraform has no NAT/EIP resources.
- [ ] Fargate uses public subnets/public IP.
- [ ] Lambdas run outside the VPC and retain logging.
- [ ] No database port is opened by AWS security groups.
- [ ] Migration/seed networking matches the new topology.
