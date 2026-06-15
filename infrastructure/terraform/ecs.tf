# ============================================================
# Phase 6b — ECS Fargate (cluster + task def + service)
# Console tương đương: ECS > Clusters / Task definitions / Services,
#                      CloudWatch > Log groups, IAM > Roles
# ============================================================

# ---------- CloudWatch log group cho container ----------
resource "aws_cloudwatch_log_group" "api" {
    name              = "/ecs/${var.project}-api"
    retention_in_days = 14
}

# ---------- ECS Cluster ----------
resource "aws_ecs_cluster" "main" {
    name = "${var.project}-ecs"
}

# ============================================================
# IAM — Execution role (kéo image + lấy secret + ghi log)
# ============================================================
data "aws_iam_policy_document" "ecs_assume" {
    statement {
        actions = ["sts:AssumeRole"]
        principals {
            type        = "Service"
            identifiers = ["ecs-tasks.amazonaws.com"]
        }
    }
}

resource "aws_iam_role" "ecs_execution" {
    name               = "${var.project}-ecs-execution"
    assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
    role       = aws_iam_role.ecs_execution.name
    policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Cho execution role đọc secret DATABASE_URL (để inject lúc container start)
resource "aws_iam_role_policy" "ecs_execution_secret" {
    role = aws_iam_role.ecs_execution.id
    policy = jsonencode({
        Version = "2012-10-17"
        Statement = [{
            Effect   = "Allow"
            Action   = ["secretsmanager:GetSecretValue"]
            Resource = aws_secretsmanager_secret.database_url.arn
        }]
    })
}

# ============================================================
# IAM — Task role (quyền RUNTIME của API => bỏ hẳn AWS key khỏi env)
# ============================================================
resource "aws_iam_role" "ecs_task" {
    name               = "${var.project}-ecs-task"
    assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy" "ecs_task" {
    role = aws_iam_role.ecs_task.id
    policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
            {
                Sid      = "S3PresignedUploads"
                Effect   = "Allow"
                Action   = ["s3:PutObject", "s3:GetObject"]
                Resource = "${aws_s3_bucket.imports.arn}/*"
            },
            {
                Sid    = "InvokeOpsLambdas"
                Effect = "Allow"
                Action = ["lambda:InvokeFunction"]
                Resource = [
                    aws_lambda_function.fn["report-exporter"].arn,
                    aws_lambda_function.fn["dlq-replay"].arn,
                    aws_lambda_function.fn["reconciliation"].arn,
                ]
            },
            {
                Sid      = "ConfirmCancelImport"
                Effect   = "Allow"
                Action   = ["states:SendTaskSuccess", "states:SendTaskFailure"]
                Resource = "*" # task token không scope theo resource được
            },
            {
                Sid      = "SendEmail"
                Effect   = "Allow"
                Action   = ["ses:SendEmail", "ses:SendRawEmail"]
                Resource = "*"
            },
            {
                Sid    = "CognitoAdmin"
                Effect = "Allow"
                Action = [
                    "cognito-idp:AdminCreateUser",
                    "cognito-idp:AdminDeleteUser",
                    "cognito-idp:AdminGetUser",
                    "cognito-idp:AdminUpdateUserAttributes",
                    "cognito-idp:AdminDisableUser",
                    "cognito-idp:AdminEnableUser",
                ]
                Resource = "arn:aws:cognito-idp:${var.aws_region}:${local.account_id}:userpool/${var.cognito_user_pool_id}"
            },
        ]
    })
}

# ============================================================
# Task Definition (Fargate, x86_64 vì image build từ node:20-slim amd64)
# ============================================================
resource "aws_ecs_task_definition" "api" {
    family                   = "${var.project}-api"
    requires_compatibilities = ["FARGATE"]
    network_mode             = "awsvpc"
    cpu                      = 512
    memory                   = 1024
    execution_role_arn       = aws_iam_role.ecs_execution.arn
    task_role_arn            = aws_iam_role.ecs_task.arn

    runtime_platform {
        operating_system_family = "LINUX"
        cpu_architecture        = "X86_64"
    }

    container_definitions = jsonencode([{
        name      = "api"
        image     = "${local.ecr_url}:latest"
        essential = true

        portMappings = [{ containerPort = 3000, protocol = "tcp" }]

        environment = [
            { name = "NODE_ENV", value = "production" },
            { name = "PORT", value = "3000" },
            { name = "CORS_ORIGIN", value = var.frontend_url },
            { name = "FRONTEND_URL", value = var.frontend_url },
            { name = "SWAGGER_ENABLED", value = "false" },
            { name = "AWS_REGION", value = var.aws_region },
            { name = "AWS_S3_BUCKET", value = aws_s3_bucket.imports.bucket },
            { name = "REPORT_EXPORTER_LAMBDA_ARN", value = aws_lambda_function.fn["report-exporter"].arn },
            { name = "DLQ_REPLAY_LAMBDA_ARN", value = aws_lambda_function.fn["dlq-replay"].arn },
            { name = "RECONCILIATION_LAMBDA_ARN", value = aws_lambda_function.fn["reconciliation"].arn },
            { name = "COGNITO_REGION", value = var.aws_region },
            { name = "COGNITO_USER_POOL_ID", value = var.cognito_user_pool_id },
            { name = "COGNITO_CLIENT_ID", value = var.cognito_client_id },
            { name = "PUSHER_APP_ID", value = var.pusher_app_id },
            { name = "PUSHER_KEY", value = var.pusher_key },
            { name = "PUSHER_CLUSTER", value = var.pusher_cluster },
            { name = "PUSHER_SECRET", value = var.pusher_secret },
        ]

        # DATABASE_URL nhạy cảm => inject từ Secrets Manager, không lộ trong task def
        secrets = [
            { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
        ]

        logConfiguration = {
            logDriver = "awslogs"
            options = {
                "awslogs-group"         = aws_cloudwatch_log_group.api.name
                "awslogs-region"        = var.aws_region
                "awslogs-stream-prefix" = "api"
            }
        }
    }])
}

# ============================================================
# ECS Service — desired_count theo CÔNG TẮC system_on
# ============================================================
resource "aws_ecs_service" "api" {
    name            = "${var.project}-api"
    cluster         = aws_ecs_cluster.main.id
    task_definition = aws_ecs_task_definition.api.arn
    desired_count   = var.system_on ? 1 : 0 # tắt hệ thống = 0 task = hết tiền compute
    launch_type     = "FARGATE"

    network_configuration {
        subnets          = [aws_subnet.private_a.id, aws_subnet.private_b.id]
        security_groups  = [aws_security_group.api.id]
        assign_public_ip = false # private subnet, ra ngoài qua NAT
    }

    load_balancer {
        target_group_arn = aws_lb_target_group.api.arn
        container_name   = "api"
        container_port   = 3000
    }

    health_check_grace_period_seconds = 90 # cho container thời gian boot + Aurora thức dậy

    depends_on = [aws_lb_listener.https, terraform_data.api_image]
}
