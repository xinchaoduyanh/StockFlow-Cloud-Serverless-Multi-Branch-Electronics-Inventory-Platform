# ============================================================
# API — NestJS trên Lambda + API Gateway HTTP API
# Console tương đương: Lambda > Functions, API Gateway > APIs / Custom domain names,
#                      IAM > Roles, CloudWatch > Log groups
#
# Thay cho ECS Fargate + ALB + ECR: không có gì tính tiền khi không có request.
# ============================================================

# Cert regional đã validate sẵn ở ap-southeast-1 => chỉ ĐỌC, destroy không đụng cert.
data "aws_acm_certificate" "api" {
  domain      = "api.vuduyanh.id.vn"
  statuses    = ["ISSUED"]
  most_recent = true
}

locals {
  api_function_name = "${var.project}-api"
}

# ---------- Code: dist/api-lambda (npm run build && npm run build:api-lambda) ----------
data "archive_file" "api" {
  type        = "zip"
  source_dir  = "${path.module}/../../dist/api-lambda"
  output_path = "${path.module}/builds/api.zip"
}

# Gói > 50MB không upload trực tiếp được nên đi qua bucket artifacts, key đổi theo md5.
resource "aws_s3_object" "api" {
  bucket = aws_s3_bucket.lambda_artifacts.id
  key    = "api/${data.archive_file.api.output_md5}.zip"
  source = data.archive_file.api.output_path
  etag   = data.archive_file.api.output_md5
}

# ---------- IAM ----------
resource "aws_iam_role" "api" {
  name               = "${var.project}-api"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "api_basic" {
  role       = aws_iam_role.api.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# X-Ray active tracing cần quyền gửi segment.
resource "aws_iam_role_policy_attachment" "api_xray" {
  role       = aws_iam_role.api.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}

resource "aws_iam_role_policy" "api" {
  role = aws_iam_role.api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadDatabaseUrl"
        Effect   = "Allow"
        Action   = ["ssm:GetParameter"]
        Resource = aws_ssm_parameter.database_url.arn
      },
      {
        Sid      = "S3PresignedUploads"
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject"]
        Resource = "${aws_s3_bucket.imports.arn}/*"
      },
      {
        Sid      = "InvokeOpsLambdas"
        Effect   = "Allow"
        Action   = ["lambda:InvokeFunction"]
        Resource = [aws_lambda_function.fn["reconciliation"].arn]
      },
      {
        Sid      = "SendReportJob"
        Effect   = "Allow"
        Action   = ["sqs:SendMessage"]
        Resource = aws_sqs_queue.report_jobs.arn
      },
      {
        Sid    = "InspectRecoveryQueues"
        Effect = "Allow"
        Action = ["sqs:GetQueueAttributes", "sqs:ListMessageMoveTasks"]
        Resource = [
          aws_sqs_queue.report_jobs.arn,
          aws_sqs_queue.report_jobs_dlq.arn,
        ]
      },
      {
        Sid    = "StartReportDlqRedrive"
        Effect = "Allow"
        Action = [
          "sqs:StartMessageMoveTask",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
        ]
        Resource = aws_sqs_queue.report_jobs_dlq.arn
      },
      {
        Sid      = "StartImportRecovery"
        Effect   = "Allow"
        Action   = ["states:StartExecution"]
        Resource = aws_sfn_state_machine.ingestion.arn
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

# ---------- Lambda ----------
# Log group tạo tường minh (giữ 14 ngày) trước khi Lambda tự tạo log group không hết hạn.
resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${local.api_function_name}"
  retention_in_days = 14
}

resource "aws_lambda_function" "api" {
  function_name = local.api_function_name
  role          = aws_iam_role.api.arn
  runtime       = "nodejs22.x"
  architectures = ["arm64"]
  handler       = "index.handler"
  timeout       = 29   # API Gateway cắt request ở 30 giây
  memory_size   = 1024 # CPU tỉ lệ với RAM => cold start NestJS nhanh hơn

  # Không đặt reserved_concurrent_executions: AWS bắt buộc phần chưa reserve của tài khoản
  # >= 10, mà hạn mức mặc định của tài khoản mới chỉ là 10. Chặn chi phí (denial of wallet)
  # nhờ throttling của API Gateway; nâng hạn mức rồi mới reserve được.

  s3_bucket        = aws_s3_bucket.lambda_artifacts.id
  s3_key           = aws_s3_object.api.key
  source_code_hash = data.archive_file.api.output_base64sha256

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      NODE_ENV                        = "production"
      DATABASE_URL_SSM_PARAMETER      = local.database_url_parameter
      GIT_SHA                         = var.git_sha
      CORS_ORIGIN                     = var.frontend_url
      FRONTEND_URL                    = var.frontend_url
      SWAGGER_ENABLED                 = "false"
      AWS_S3_BUCKET                   = aws_s3_bucket.imports.bucket
      REPORT_DISPATCH_MODE            = "sqs"
      REPORT_QUEUE_URL                = aws_sqs_queue.report_jobs.url
      REPORT_QUEUE_DLQ_URL            = aws_sqs_queue.report_jobs_dlq.url
      REPORT_MAX_RECEIVE_COUNT        = tostring(var.report_max_receive_count)
      REPORT_PROCESSING_LEASE_SECONDS = tostring(var.report_queue_visibility_timeout_seconds)
      IMPORT_STATE_MACHINE_ARN        = aws_sfn_state_machine.ingestion.arn
      IMPORT_RECOVERY_QUEUE_URL       = aws_sqs_queue.import_recovery.url
      IMPORT_RECOVERY_DLQ_URL         = aws_sqs_queue.import_recovery_dlq.url
      IMPORT_APPROVAL_TIMEOUT_SECONDS = tostring(var.import_approval_timeout_seconds)
      IMPORT_MAX_REPLAY_COUNT         = "3"
      NOTIFICATION_SNS_TOPIC_ARN      = aws_sns_topic.notifications.arn
      SNS_CALLBACK_ALLOW_LOCAL        = "false"
      RECONCILIATION_LAMBDA_ARN       = aws_lambda_function.fn["reconciliation"].arn
      COGNITO_REGION                  = var.aws_region
      COGNITO_USER_POOL_ID            = var.cognito_user_pool_id
      COGNITO_CLIENT_ID               = var.cognito_client_id
      PUSHER_APP_ID                   = var.pusher_app_id
      PUSHER_KEY                      = var.pusher_key
      PUSHER_CLUSTER                  = var.pusher_cluster
      PUSHER_SECRET                   = var.pusher_secret
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.api,
    aws_iam_role_policy_attachment.api_basic,
    aws_iam_role_policy_attachment.api_xray,
    aws_iam_role_policy.api,
  ]
}

# ---------- API Gateway HTTP API ----------
# CORS do NestJS (setupApp/enableCors) xử lý để chỉ có một nguồn sự thật cho danh sách origin;
# bật thêm CORS ở API Gateway sẽ khiến preflight bị trả header trùng.
resource "aws_apigatewayv2_api" "api" {
  name          = "${var.project}-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.api.id}"
}

resource "aws_cloudwatch_log_group" "api_access" {
  name              = "/aws/apigateway/${var.project}-api-access"
  retention_in_days = 14
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true

  # Chặn lưu lượng bất thường: vượt rate/burst thì API Gateway trả 429 và Lambda không bị gọi.
  default_route_settings {
    throttling_rate_limit  = 20
    throttling_burst_limit = 40
  }

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_access.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      path           = "$context.path"
      status         = "$context.status"
      responseLength = "$context.responseLength"
      latencyMs      = "$context.responseLatency"
      integrationMs  = "$context.integrationLatency"
      errorMessage   = "$context.error.message"
    })
  }
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowHttpApiInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

# ---------- Custom domain api.vuduyanh.id.vn ----------
resource "aws_apigatewayv2_domain_name" "api" {
  domain_name = "api.vuduyanh.id.vn"

  domain_name_configuration {
    certificate_arn = data.aws_acm_certificate.api.arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

resource "aws_apigatewayv2_api_mapping" "api" {
  api_id      = aws_apigatewayv2_api.api.id
  domain_name = aws_apigatewayv2_domain_name.api.id
  stage       = aws_apigatewayv2_stage.default.id
}

# ---------- Log group cho 8 Lambda worker (giữ 14 ngày, đóng OD-11) ----------
resource "aws_cloudwatch_log_group" "worker" {
  for_each          = local.lambdas
  name              = "/aws/lambda/${var.project}-${each.key}"
  retention_in_days = 14
}
