# ============================================================
# Phase 3 — Database: Aurora Serverless v2 + Secrets Manager
# Console tương đương: RDS > Databases / Subnet groups,
#                      Secrets Manager > Secrets
# ============================================================

# ---------- Master password: Terraform TỰ SINH, không gõ tay ----------
# special = false => chỉ chữ + số => không dính ký tự phải URL-encode
# (vd '@' '/' ':') khi ghép vào chuỗi DATABASE_URL bên dưới.
resource "random_password" "db_master" {
  length  = 32
  special = false
}

# ---------- DB Subnet Group: Aurora nằm ở 2 PRIVATE subnet ----------
# Aurora bắt buộc khai subnet group >= 2 AZ. Đặt ở private => không ai
# ngoài internet chọc thẳng vào DB được.
resource "aws_db_subnet_group" "main" {
  name       = "${var.project}-db-subnet-group"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]

  tags = {
    Name = "${var.project}-db-subnet-group"
  }
}

# ---------- Aurora Cluster (PostgreSQL Serverless v2) ----------
# engine_mode = "provisioned" + block serverlessv2 = đây chính là Serverless v2.
resource "aws_rds_cluster" "main" {
  cluster_identifier = "${var.project}-aurora"
  engine             = "aurora-postgresql"
  engine_mode        = "provisioned"
  engine_version     = "16.10" # >= 16.3 mới cho min_capacity = 0 (scale-to-zero)
  database_name      = "stockflow"
  master_username    = "stockflow_admin"
  master_password    = random_password.db_master.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id] # db_sg từ Phase 2

  serverlessv2_scaling_configuration {
    min_capacity             = 0   # 0 ACU = tự PAUSE khi không có kết nối => compute = 0đ
    max_capacity             = 2   # trần khi tải cao
    seconds_until_auto_pause = 600 # im lặng 10 phút thì ngủ
  }

  skip_final_snapshot = true # đồ án: destroy nhanh, không bắt tạo snapshot cuối
  apply_immediately   = true # đổi cấu hình áp dụng ngay, không đợi maintenance window

  tags = {
    Name = "${var.project}-aurora"
  }
}

# ---------- Aurora Instance: 1 node serverless trong cluster ----------
resource "aws_rds_cluster_instance" "main" {
  identifier         = "${var.project}-aurora-1"
  cluster_identifier = aws_rds_cluster.main.id
  instance_class     = "db.serverless" # class đặc biệt cho Serverless v2
  engine             = aws_rds_cluster.main.engine

  publicly_accessible = false # private hoàn toàn — chỉ truy cập từ trong VPC

  tags = {
    Name = "${var.project}-aurora-1"
  }
}

# ---------- Secrets Manager: DATABASE_URL ----------
# Terraform tự ghép URL từ output cluster -> không có .env nào chứa mật khẩu DB.
resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${var.project}/database-url"
  description             = "DATABASE_URL cho API (ECS) + Lambdas"
  recovery_window_in_days = 0 # destroy là xóa NGAY, không kẹt tên 7-30 ngày

  tags = {
    Name = "${var.project}-database-url"
  }
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id = aws_secretsmanager_secret.database_url.id
  # connection_limit=1 BẮT BUỘC: Aurora không có pgbouncer như Neon
  secret_string = "postgresql://${aws_rds_cluster.main.master_username}:${random_password.db_master.result}@${aws_rds_cluster.main.endpoint}:5432/${aws_rds_cluster.main.database_name}?connection_limit=1"
}
