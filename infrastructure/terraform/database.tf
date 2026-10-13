# ============================================================
# Database — Neon Postgres (nằm ngoài AWS) + SSM Parameter Store
# Console tương đương: Systems Manager > Parameter Store
#
# Neon chạy ở ngoài AWS nên không còn VPC, NAT hay subnet group.
# Chuỗi kết nối là secret: đi vào qua terraform.tfvars (máy chủ dự án) hoặc GitHub secret
# (pipeline), nằm ở SSM dạng SecureString và Lambda đọc lúc cold start. Nó không bao giờ
# xuất hiện trong biến môi trường của Lambda.
# ============================================================

# URL qua pooler (PgBouncer) cho runtime. Phải có
# `sslmode=require&pgbouncer=true&connection_limit=1`.
resource "aws_ssm_parameter" "database_url" {
  name        = "/${var.project}/database-url"
  description = "Neon pooled connection string cho API và Lambda"
  type        = "SecureString"
  value       = var.neon_database_url
}

# URL trực tiếp (không qua pooler) chỉ dùng cho `prisma migrate deploy` từ máy dev / pipeline.
resource "aws_ssm_parameter" "direct_url" {
  name        = "/${var.project}/direct-url"
  description = "Neon direct connection string cho prisma migrate"
  type        = "SecureString"
  value       = var.neon_direct_url
}

locals {
  database_url_parameter = aws_ssm_parameter.database_url.name
}
