# ============================================================
# P5 — Email báo cáo vận hành hằng ngày
# Console tương đương: SES > Verified identities, EventBridge > Scheduler > Schedules,
#                      IAM > Roles
#
# Lambda `daily-ops-report` được khai báo trong local.lambdas (serverless.tf) nên role, log
# group, quyền đọc SSM và function đã được tạo theo vòng lặp chung; file này chỉ thêm phần riêng:
# quyền đọc metric/log, danh tính SES và lịch chạy. Chi phí: ~30 email/tháng và ~30 lần
# GetMetricData/Logs Insights, đều trong free tier hoặc cỡ cent.
# ============================================================

locals {
  # Cùng một địa chỉ vừa gửi vừa nhận: SES sandbox chỉ gửi được tới địa chỉ đã verify, và
  # báo cáo chỉ gửi cho chủ dự án nên không cần xin ra khỏi sandbox.
  ops_report_enabled = var.ops_alert_email != ""
}

# Trạng thái "Pending" tới khi chủ dự án bấm link trong email xác minh của AWS.
resource "aws_sesv2_email_identity" "ops_report" {
  count          = local.ops_report_enabled ? 1 : 0
  email_identity = var.ops_alert_email
}

resource "aws_iam_role_policy" "daily_ops_report_read_telemetry" {
  role = aws_iam_role.lambda["daily-ops-report"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # GetMetricData và DescribeAlarms không hỗ trợ giới hạn theo resource.
        Sid      = "ReadMetricsAndAlarms"
        Effect   = "Allow"
        Action   = ["cloudwatch:GetMetricData", "cloudwatch:DescribeAlarms"]
        Resource = "*"
      },
      {
        Sid    = "QueryApiLogs"
        Effect = "Allow"
        Action = ["logs:StartQuery"]
        Resource = [
          "${aws_cloudwatch_log_group.api.arn}:*",
          "${aws_cloudwatch_log_group.api_access.arn}:*",
        ]
      },
      {
        # Kết quả truy vấn không gắn với log group nên chỉ scope được bằng "*".
        Sid      = "ReadQueryResults"
        Effect   = "Allow"
        Action   = ["logs:GetQueryResults"]
        Resource = "*"
      },
    ]
  })
}

resource "aws_iam_role_policy" "daily_ops_report_send_email" {
  count = local.ops_report_enabled ? 1 : 0
  role  = aws_iam_role.lambda["daily-ops-report"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ses:SendEmail"]
      Resource = aws_sesv2_email_identity.ops_report[0].arn
    }]
  })
}

# ---------- EventBridge Scheduler ----------
# Dùng Scheduler thay cho EventBridge Rule vì Scheduler nhận múi giờ trực tiếp,
# không phải tự quy đổi 07:00 ICT sang UTC.
data "aws_iam_policy_document" "scheduler_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "daily_ops_report_scheduler" {
  name               = "${var.project}-scheduler-daily-ops-report"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume.json
}

resource "aws_iam_role_policy" "daily_ops_report_scheduler_invoke" {
  role = aws_iam_role.daily_ops_report_scheduler.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["lambda:InvokeFunction"]
      Resource = aws_lambda_function.fn["daily-ops-report"].arn
    }]
  })
}

resource "aws_scheduler_schedule" "daily_ops_report" {
  count                        = local.ops_report_enabled ? 1 : 0
  name                         = "${var.project}-daily-ops-report"
  description                  = "Gửi email báo cáo vận hành của 24 giờ qua"
  schedule_expression          = "cron(0 7 * * ? *)"
  schedule_expression_timezone = "Asia/Ho_Chi_Minh"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.fn["daily-ops-report"].arn
    role_arn = aws_iam_role.daily_ops_report_scheduler.arn

    retry_policy {
      maximum_retry_attempts       = 2
      maximum_event_age_in_seconds = 3600
    }
  }
}
