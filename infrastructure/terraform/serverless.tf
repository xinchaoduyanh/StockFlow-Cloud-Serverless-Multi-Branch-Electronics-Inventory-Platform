# ============================================================
# Phase 4 — Serverless stack (port từ apps/lambdas/template.yaml)
# Console tương đương: S3 / Lambda / Step Functions / SNS /
#                      EventBridge (Rules + Schedules) / IAM Roles
# ============================================================

data "aws_caller_identity" "current" {}

locals {
    account_id = data.aws_caller_identity.current.account_id
    lambda_src = "${path.module}/../../dist/lambdas"

    # ARN state machine GHÉP TAY từ tên cố định (region + account + name).
    # Lý do: dlq-replay cần ARN này trong env, nhưng state machine lại gọi
    # 5 lambda khác => nếu tham chiếu thẳng resource sẽ tạo VÒNG LẶP phụ thuộc.
    # Ghép chuỗi tĩnh thì không tạo cạnh phụ thuộc => phá vòng lặp.
    state_machine_arn = "arn:aws:states:${var.aws_region}:${local.account_id}:stateMachine:${var.project}-ingestion"

    # 8 Lambda: timeout (giây) + memory (MB), khớp template.yaml
    lambdas = {
        "import-validator"               = { timeout = 60, memory = 256 }
        "import-parser"                  = { timeout = 300, memory = 512 }
        "import-approval-token-register" = { timeout = 60, memory = 256 }
        "import-writer"                  = { timeout = 180, memory = 256 }
        "import-job-fail-handler"        = { timeout = 60, memory = 256 }
        "report-exporter"                = { timeout = 120, memory = 512 }
        "dlq-replay"                     = { timeout = 120, memory = 256 }
        "reconciliation"                 = { timeout = 300, memory = 512 }
    }

    # Env RIÊNG cho từng lambda (env chung DATABASE_URL/S3_BUCKET set ở dưới).
    # dlq-replay dùng state_machine_arn GHÉP TAY (không reference resource).
    lambda_env = {
        "import-writer"           = { NOTIFICATION_SNS_TOPIC_ARN = aws_sns_topic.notifications.arn }
        "import-job-fail-handler" = { NOTIFICATION_SNS_TOPIC_ARN = aws_sns_topic.notifications.arn }
        "dlq-replay"              = { STATE_MACHINE_ARN = local.state_machine_arn }
    }
}

# ============================================================
# 1. S3 — bucket imports (upload Excel) + bucket artifacts (zip lambda)
# ============================================================
resource "aws_s3_bucket" "imports" {
    bucket        = "${var.project}-imports-${local.account_id}-${var.aws_region}"
    force_destroy = true # cho phép destroy kể cả khi còn file
}

# Chặn public hoàn toàn — truy cập qua presigned URL nên không cần public
resource "aws_s3_bucket_public_access_block" "imports" {
    bucket                  = aws_s3_bucket.imports.id
    block_public_acls       = true
    block_public_policy     = true
    ignore_public_acls      = true
    restrict_public_buckets = true
}

# CORS: chỉ cho domain thật + localhost (KHÁC SAM cũ để '*')
resource "aws_s3_bucket_cors_configuration" "imports" {
    bucket = aws_s3_bucket.imports.id
    cors_rule {
        allowed_headers = ["*"]
        allowed_methods = ["POST", "GET", "PUT", "HEAD"]
        allowed_origins = [var.frontend_url, "http://localhost:3000"]
        expose_headers  = ["ETag"]
        max_age_seconds = 3000
    }
}

# Bật EventBridge notification => mỗi object tạo ra bắn 1 event
resource "aws_s3_bucket_notification" "imports" {
    bucket      = aws_s3_bucket.imports.id
    eventbridge = true
}

# Bucket chứa zip code lambda (deploy qua S3 vì zip > 50MB)
resource "aws_s3_bucket" "lambda_artifacts" {
    bucket        = "${var.project}-lambda-artifacts-${local.account_id}-${var.aws_region}"
    force_destroy = true
}

# ============================================================
# 2. Đóng gói + upload code 8 Lambda lên S3
# ============================================================
data "archive_file" "lambda" {
    for_each    = local.lambdas
    type        = "zip"
    source_dir  = "${local.lambda_src}/${each.key}"
    output_path = "${path.module}/builds/${each.key}.zip"
}

resource "aws_s3_object" "lambda" {
    for_each = local.lambdas
    bucket   = aws_s3_bucket.lambda_artifacts.id
    # key đổi theo md5 code => code đổi => key đổi => Lambda nạp bản mới
    key    = "${each.key}/${data.archive_file.lambda[each.key].output_md5}.zip"
    source = data.archive_file.lambda[each.key].output_path
    etag   = data.archive_file.lambda[each.key].output_md5
}

# ============================================================
# 3. IAM — mỗi Lambda 1 role riêng + quyền vào VPC + quyền riêng
# ============================================================
data "aws_iam_policy_document" "lambda_assume" {
    statement {
        actions = ["sts:AssumeRole"]
        principals {
            type        = "Service"
            identifiers = ["lambda.amazonaws.com"]
        }
    }
}

resource "aws_iam_role" "lambda" {
    for_each           = local.lambdas
    name               = "${var.project}-lambda-${each.key}"
    assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

# Quyền tạo ENI trong VPC — BẮT BUỘC với mọi lambda chạy trong VPC
resource "aws_iam_role_policy_attachment" "lambda_vpc" {
    for_each   = local.lambdas
    role       = aws_iam_role.lambda[each.key].name
    policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# Chờ IAM lan truyền trước khi tạo lambda — tránh lỗi InsufficientRolePermissions
# (role vừa tạo + gắn policy cần ~vài giây mới có hiệu lực toàn cầu)
resource "time_sleep" "wait_iam_propagation" {
    depends_on      = [aws_iam_role_policy_attachment.lambda_vpc]
    create_duration = "20s"
}

# --- Quyền riêng từng lambda ---
resource "aws_iam_role_policy" "validator_s3" {
    role = aws_iam_role.lambda["import-validator"].id
    policy = jsonencode({
        Version = "2012-10-17"
        Statement = [{
            Effect   = "Allow"
            Action   = ["s3:GetObject", "s3:PutObject"]
            Resource = "${aws_s3_bucket.imports.arn}/*"
        }]
    })
}

resource "aws_iam_role_policy" "parser_s3" {
    role = aws_iam_role.lambda["import-parser"].id
    policy = jsonencode({
        Version = "2012-10-17"
        Statement = [{
            Effect   = "Allow"
            Action   = ["s3:GetObject"]
            Resource = "${aws_s3_bucket.imports.arn}/*"
        }]
    })
}

resource "aws_iam_role_policy" "report_exporter_s3" {
    role = aws_iam_role.lambda["report-exporter"].id
    policy = jsonencode({
        Version = "2012-10-17"
        Statement = [{
            Effect   = "Allow"
            Action   = ["s3:PutObject"]
            Resource = "${aws_s3_bucket.imports.arn}/reports/*"
        }]
    })
}

resource "aws_iam_role_policy" "writer_sns" {
    role = aws_iam_role.lambda["import-writer"].id
    policy = jsonencode({
        Version = "2012-10-17"
        Statement = [{
            Effect   = "Allow"
            Action   = ["sns:Publish"]
            Resource = aws_sns_topic.notifications.arn
        }]
    })
}

resource "aws_iam_role_policy" "fail_handler_sns" {
    role = aws_iam_role.lambda["import-job-fail-handler"].id
    policy = jsonencode({
        Version = "2012-10-17"
        Statement = [{
            Effect   = "Allow"
            Action   = ["sns:Publish"]
            Resource = aws_sns_topic.notifications.arn
        }]
    })
}

resource "aws_iam_role_policy" "dlq_replay_sfn" {
    role = aws_iam_role.lambda["dlq-replay"].id
    policy = jsonencode({
        Version = "2012-10-17"
        Statement = [{
            Effect   = "Allow"
            Action   = ["states:StartExecution"]
            Resource = local.state_machine_arn
        }]
    })
}

# ============================================================
# 4. 8 Lambda functions (nodejs20.x, arm64, trong VPC)
# ============================================================
resource "aws_lambda_function" "fn" {
    for_each      = local.lambdas
    function_name = "${var.project}-${each.key}"
    role          = aws_iam_role.lambda[each.key].arn
    runtime       = "nodejs20.x"
    architectures = ["arm64"]
    handler       = "index.handler"
    timeout       = each.value.timeout
    memory_size   = each.value.memory

    s3_bucket        = aws_s3_bucket.lambda_artifacts.id
    s3_key           = aws_s3_object.lambda[each.key].key
    source_code_hash = data.archive_file.lambda[each.key].output_base64sha256

    vpc_config {
        subnet_ids         = [aws_subnet.private_a.id, aws_subnet.private_b.id]
        security_group_ids = [aws_security_group.lambda.id]
    }

    environment {
        variables = merge(
            {
                # DATABASE_URL lấy thẳng từ secret Phase 3 (chấp nhận hiện trong console Lambda)
                DATABASE_URL = aws_secretsmanager_secret_version.database_url.secret_string
                S3_BUCKET    = aws_s3_bucket.imports.bucket
            },
            lookup(local.lambda_env, each.key, {})
        )
    }

    depends_on = [time_sleep.wait_iam_propagation]
}

# ============================================================
# 5. SNS topic — thông báo kết quả import
# ============================================================
resource "aws_sns_topic" "notifications" {
    name = "${var.project}-notifications-${local.account_id}-${var.aws_region}"
}

# ============================================================
# 6. Step Functions — orchestrator pipeline
# ============================================================
data "aws_iam_policy_document" "sfn_assume" {
    statement {
        actions = ["sts:AssumeRole"]
        principals {
            type        = "Service"
            identifiers = ["states.amazonaws.com"]
        }
    }
}

resource "aws_iam_role" "sfn" {
    name               = "${var.project}-sfn"
    assume_role_policy = data.aws_iam_policy_document.sfn_assume.json
}

resource "aws_iam_role_policy" "sfn_invoke" {
    role = aws_iam_role.sfn.id
    policy = jsonencode({
        Version = "2012-10-17"
        Statement = [{
            Effect = "Allow"
            Action = "lambda:InvokeFunction"
            Resource = [
                aws_lambda_function.fn["import-validator"].arn,
                aws_lambda_function.fn["import-parser"].arn,
                aws_lambda_function.fn["import-approval-token-register"].arn,
                aws_lambda_function.fn["import-writer"].arn,
                aws_lambda_function.fn["import-job-fail-handler"].arn,
            ]
        }]
    })
}

resource "aws_sfn_state_machine" "ingestion" {
    name     = "${var.project}-ingestion" # phải khớp local.state_machine_arn
    role_arn = aws_iam_role.sfn.arn

    definition = jsonencode({
        Comment = "StockFlow batch ingestion pipeline"
        StartAt = "ValidateFileStructure"
        States = {
            ValidateFileStructure = {
                Type     = "Task"
                Resource = aws_lambda_function.fn["import-validator"].arn
                Catch    = [{ ErrorEquals = ["States.ALL"], Next = "MarkJobFailed" }]
                Next     = "CheckIntegrity"
            }
            CheckIntegrity = {
                Type    = "Choice"
                Choices = [{ Variable = "$.isValid", BooleanEquals = true, Next = "ParseAndStageRows" }]
                Default = "MarkJobFailed"
            }
            ParseAndStageRows = {
                Type     = "Task"
                Resource = aws_lambda_function.fn["import-parser"].arn
                Catch    = [{ ErrorEquals = ["States.ALL"], Next = "MarkJobFailed" }]
                Next     = "HaltForUserApproval"
            }
            HaltForUserApproval = {
                Type     = "Task"
                Resource = "arn:aws:states:::lambda:invoke.waitForTaskToken"
                Parameters = {
                    FunctionName = aws_lambda_function.fn["import-approval-token-register"].arn
                    "Payload" = {
                        "importJobId.$" = "$.importJobId"
                        "taskToken.$"   = "$$.Task.Token"
                    }
                }
                Catch = [{ ErrorEquals = ["States.ALL"], Next = "MarkJobFailed" }]
                Next  = "CommitInventory"
            }
            CommitInventory = {
                Type     = "Task"
                Resource = aws_lambda_function.fn["import-writer"].arn
                End      = true
            }
            MarkJobFailed = {
                Type     = "Task"
                Resource = aws_lambda_function.fn["import-job-fail-handler"].arn
                End      = true
            }
        }
    })
}

# ============================================================
# 7. EventBridge — S3 upload (imports/) => khởi động state machine
# ============================================================
resource "aws_cloudwatch_event_rule" "s3_upload" {
    name        = "${var.project}-s3-upload"
    description = "File mới trong imports/ => chạy pipeline ingestion"
    event_pattern = jsonencode({
        source        = ["aws.s3"]
        "detail-type" = ["Object Created"]
        detail = {
            bucket = { name = [aws_s3_bucket.imports.bucket] }
            object = { key = [{ prefix = "imports/" }] }
        }
    })
}

data "aws_iam_policy_document" "eventbridge_assume" {
    statement {
        actions = ["sts:AssumeRole"]
        principals {
            type        = "Service"
            identifiers = ["events.amazonaws.com"]
        }
    }
}

resource "aws_iam_role" "eventbridge_sfn" {
    name               = "${var.project}-eventbridge-sfn"
    assume_role_policy = data.aws_iam_policy_document.eventbridge_assume.json
}

resource "aws_iam_role_policy" "eventbridge_sfn" {
    role = aws_iam_role.eventbridge_sfn.id
    policy = jsonencode({
        Version = "2012-10-17"
        Statement = [{
            Effect   = "Allow"
            Action   = "states:StartExecution"
            Resource = aws_sfn_state_machine.ingestion.arn
        }]
    })
}

resource "aws_cloudwatch_event_target" "s3_to_sfn" {
    rule     = aws_cloudwatch_event_rule.s3_upload.name
    arn      = aws_sfn_state_machine.ingestion.arn
    role_arn = aws_iam_role.eventbridge_sfn.arn

    # Rút gọn event S3 thành {bucket, key, size} đưa vào state machine
    input_transformer {
        input_paths = {
            bucket = "$.detail.bucket.name"
            key    = "$.detail.object.key"
            size   = "$.detail.object.size"
        }
        input_template = "{\"bucket\": <bucket>, \"key\": <key>, \"size\": <size>}"
    }
}

# ============================================================
# 8. EventBridge Schedule — reconciliation chạy 02:00 UTC hằng ngày
# ============================================================
resource "aws_cloudwatch_event_rule" "reconciliation" {
    name                = "${var.project}-reconciliation-daily"
    description         = "Đối soát tồn kho hằng ngày"
    schedule_expression = "cron(0 2 * * ? *)"
}

resource "aws_cloudwatch_event_target" "reconciliation" {
    rule  = aws_cloudwatch_event_rule.reconciliation.name
    arn   = aws_lambda_function.fn["reconciliation"].arn
    input = jsonencode({ dryRun = false })
}

# Cho phép EventBridge gọi lambda reconciliation
resource "aws_lambda_permission" "reconciliation_events" {
    statement_id  = "AllowEventBridgeInvoke"
    action        = "lambda:InvokeFunction"
    function_name = aws_lambda_function.fn["reconciliation"].function_name
    principal     = "events.amazonaws.com"
    source_arn    = aws_cloudwatch_event_rule.reconciliation.arn
}
