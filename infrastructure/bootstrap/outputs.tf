output "tfstate_bucket" {
  description = "Điền vào backend.hcl của stack chính"
  value       = aws_s3_bucket.tfstate.bucket
}

output "github_deploy_role_arn" {
  description = "ARN role để workflow GitHub Actions assume"
  value       = aws_iam_role.github_deploy.arn
}
