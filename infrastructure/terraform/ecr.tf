# ============================================================
# Phase 5 — ECR + build/push image API TỰ ĐỘNG (local-exec)
# Console tương đương: ECR > Repositories
# ============================================================

resource "aws_ecr_repository" "api" {
  name                 = "${var.project}-api"
  force_delete         = true # destroy được kể cả khi còn image
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true # tự quét lỗ hổng khi push
  }
}

# Giữ tối đa 5 image gần nhất — image cũ tự bị xóa, đỡ phí storage
resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Giu 5 image gan nhat"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = { type = "expire" }
    }]
  })
}

locals {
  ecr_url = aws_ecr_repository.api.repository_url # ...amazonaws.com/stockflow-api (build/push)
  # docker login chỉ vào REGISTRY HOST (không kèm /stockflow-api) — kèm path repo sẽ bị 400
  ecr_registry = split("/", aws_ecr_repository.api.repository_url)[0]
  # tag = ngày giờ build (UTC) => nhìn tag biết image dựng lúc nào
  image_tag = formatdate("YYYYMMDD-hhmmss", timestamp())
}

# Build + push image. Chỉ chạy lại khi src API / prisma schema / Dockerfile đổi.
resource "terraform_data" "api_image" {
  triggers_replace = {
    src          = sha1(join("", [for f in fileset("${path.module}/../../apps/api/src", "**") : filesha1("${path.module}/../../apps/api/src/${f}")]))
    prisma       = filesha1("${path.module}/../../apps/api/prisma/schema.prisma")
    migrations   = sha1(join("", [for f in fileset("${path.module}/../../apps/api/prisma/migrations", "**") : filesha1("${path.module}/../../apps/api/prisma/migrations/${f}")]))
    docker       = filesha1("${path.module}/../../apps/api/Dockerfile")
    dockerignore = filesha1("${path.module}/../../.dockerignore")
  }

  # ⚠️ build context = ROOT monorepo (Dockerfile COPY package.json, packages/shared, apps/api...)
  provisioner "local-exec" {
    interpreter = ["powershell", "-NoProfile", "-Command"]
    working_dir = "${path.module}/../.."
    command     = <<-EOT
            $ErrorActionPreference = "Stop"
            $pw = aws ecr get-login-password --region ${var.aws_region}
            # Dùng --password (không phải --password-stdin): pipe của PowerShell 5.1
            # làm hỏng token => ECR trả 400. Cảnh báo "insecure" vô hại trên máy dev.
            docker login --username AWS --password $pw ${local.ecr_registry}
            if ($LASTEXITCODE -ne 0) { throw "docker login failed" }
            docker build -t ${local.ecr_url}:${local.image_tag} -t ${local.ecr_url}:latest -f apps/api/Dockerfile .
            if ($LASTEXITCODE -ne 0) { throw "docker build failed" }
            docker push ${local.ecr_url}:${local.image_tag}
            docker push ${local.ecr_url}:latest
            if ($LASTEXITCODE -ne 0) { throw "docker push failed" }
        EOT
  }

  depends_on = [aws_ecr_repository.api]
}
