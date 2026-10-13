# ============================================================
# Outputs — giá trị in ra sau apply, để các phase sau / bạn dùng
# ============================================================

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

# --- API (P2) ---
output "api_invoke_url" {
  description = "URL mặc định của API Gateway, dùng để thử trước khi trỏ DNS"
  value       = aws_apigatewayv2_api.api.api_endpoint
}

output "api_domain_target" {
  description = "Trỏ CNAME api.vuduyanh.id.vn về đây (DNS ở iNET, làm tay)"
  value       = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].target_domain_name
}

output "api_lambda_name" {
  value = aws_lambda_function.api.function_name
}

# --- Cấu hình build frontend (không phải secret): pipeline sinh .env.production từ đây ---
output "api_base_url" {
  value = var.api_base_url
}

output "cognito_user_pool_id" {
  value = var.cognito_user_pool_id
}

output "cognito_client_id" {
  value = var.cognito_client_id
}

output "pusher_key" {
  value = var.pusher_key
}

output "pusher_cluster" {
  value = var.pusher_cluster
}
