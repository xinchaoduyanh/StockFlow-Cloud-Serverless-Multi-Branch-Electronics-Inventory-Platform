# ============================================================
# Outputs — giá trị in ra sau apply, để các phase sau / bạn dùng
# ============================================================

# --- Network (Phase 2) ---
output "vpc_id" {
  value = aws_vpc.main.id
}

output "private_subnet_ids" {
  value = [aws_subnet.private_a.id, aws_subnet.private_b.id]
}

# --- Database (Phase 3) ---
output "aurora_endpoint" {
  description = "Endpoint ghi (writer) của Aurora"
  value       = aws_rds_cluster.main.endpoint
}

output "database_secret_arn" {
  description = "ARN secret DATABASE_URL — Phase 4/6 inject vào Lambda/ECS"
  value       = aws_secretsmanager_secret.database_url.arn
}

# Giá trị DATABASE_URL có mật khẩu => đánh dấu sensitive, không in ra màn hình.
# Cần xem thì: terraform output -raw database_url
output "database_url" {
  value     = aws_secretsmanager_secret_version.database_url.secret_string
  sensitive = true
}

# --- Serverless (Phase 4) ---
output "imports_bucket" {
  description = "Bucket nhận file Excel upload"
  value       = aws_s3_bucket.imports.bucket
}

output "sns_topic_arn" {
  value = aws_sns_topic.notifications.arn
}

output "report_queue_url" {
  value = aws_sqs_queue.report_jobs.url
}

output "report_dlq_url" {
  value = aws_sqs_queue.report_jobs_dlq.url
}

output "notification_delivery_dlq_url" {
  value = aws_sqs_queue.notification_delivery_dlq.url
}

output "import_recovery_queue_url" {
  value = aws_sqs_queue.import_recovery.url
}

output "import_recovery_dlq_url" {
  value = aws_sqs_queue.import_recovery_dlq.url
}

output "state_machine_arn" {
  value = aws_sfn_state_machine.ingestion.arn
}

output "reconciliation_lambda_arn" {
  value = aws_lambda_function.fn["reconciliation"].arn
}

# --- ECR (Phase 5) ---
output "ecr_repository_url" {
  description = "URL repo ECR — Phase 6 task definition trỏ <url>:latest"
  value       = aws_ecr_repository.api.repository_url
}

# --- ECS + ALB (Phase 6) ---
output "alb_dns_name" {
  description = "DNS ALB — Phase 8 trỏ CNAME api.vuduyanh.id.vn về đây"
  value       = aws_lb.main.dns_name
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

# SG của API task — seed-db.ps1 dùng để chạy one-off ECS task (migrate/seed)
output "api_security_group_id" {
  value = aws_security_group.api.id
}

# --- Frontend (Phase 7) ---
output "web_bucket" {
  description = "Bucket FE — script deploy sync apps/web/out vào đây"
  value       = aws_s3_bucket.web.bucket
}

output "cloudfront_domain" {
  description = "Domain CloudFront — Phase 8 trỏ CNAME app.vuduyanh.id.vn về đây"
  value       = aws_cloudfront_distribution.web.domain_name
}

output "cloudfront_distribution_id" {
  description = "ID distribution — script deploy dùng để create-invalidation"
  value       = aws_cloudfront_distribution.web.id
}
