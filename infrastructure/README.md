# Infrastructure

Infrastructure as Code workspace for AWS resources.

Terraform in `infrastructure/terraform` is the only production infrastructure owner for this
repository. Validate and inspect a saved plan before deployment:

```bash
terraform -chdir=infrastructure/terraform fmt -check
terraform -chdir=infrastructure/terraform validate
terraform -chdir=infrastructure/terraform plan -out=stockflow.tfplan
```

Do not deploy these resources through a second SAM, CDK, or CloudFormation stack.
