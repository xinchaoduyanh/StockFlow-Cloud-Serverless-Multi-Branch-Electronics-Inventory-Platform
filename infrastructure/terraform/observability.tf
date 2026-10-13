# ============================================================
# P4 — Observability không cần server
# Console tương đương: CloudWatch > Dashboards / Alarms, SNS > Topics > Subscriptions
#
# Metrics, logs, traces và alerting đều do dịch vụ managed của AWS đảm nhiệm nên idle ≈ $0.
# Giữ <= 10 alarm và <= 3 dashboard để nằm trong free tier.
# ============================================================

# ---------- SNS: nơi mọi alarm gửi tới ----------
resource "aws_sns_topic" "ops_alerts" {
  name = "${var.project}-ops-alerts"
}

# Email subscription ở trạng thái "Pending confirmation" tới khi chủ dự án bấm link trong
# email AWS gửi; Terraform không tự xác nhận được.
resource "aws_sns_topic_subscription" "ops_alerts_email" {
  count     = var.ops_alert_email == "" ? 0 : 1
  topic_arn = aws_sns_topic.ops_alerts.arn
  protocol  = "email"
  endpoint  = var.ops_alert_email
}

locals {
  worker_names = [for name in keys(local.lambdas) : "${var.project}-${name}"]
  lambda_names = concat([local.api_function_name], local.worker_names)
  business_counts = {
    "ImportRowsCommitted"    = "import-writer"
    "ImportJobFailed"        = "import-job-fail-handler"
    "ReportGenerated"        = "report-exporter"
    "TransferApproved"       = "stockflow-api"
    "ReconciliationMismatch" = "reconciliation"
  }
  dlq_names = [
    aws_sqs_queue.report_jobs_dlq.name,
    aws_sqs_queue.import_recovery_dlq.name,
    aws_sqs_queue.notification_delivery_dlq.name,
  ]
}

# ---------- Alarm ----------
resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "${var.project}-api-5xx"
  alarm_description   = "API returned more than 5 server errors in 5 minutes"
  namespace           = "AWS/ApiGateway"
  metric_name         = "5xx"
  dimensions          = { ApiId = aws_apigatewayv2_api.api.id }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 5
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.ops_alerts.arn]
}

# Ngưỡng cao vì cold start NestJS + Neon thức dậy mất khoảng 3 giây ở request đầu.
resource "aws_cloudwatch_metric_alarm" "api_latency_p95" {
  alarm_name          = "${var.project}-api-latency-p95"
  alarm_description   = "API p95 latency stayed above 3s for 15 minutes"
  namespace           = "AWS/ApiGateway"
  metric_name         = "Latency"
  dimensions          = { ApiId = aws_apigatewayv2_api.api.id }
  extended_statistic  = "p95"
  period              = 300
  evaluation_periods  = 3
  threshold           = 3000
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.ops_alerts.arn]
}

# Lambda api không có reserved concurrency (hạn mức tài khoản chỉ 10), nên throttle ở đây
# nghĩa là toàn bộ Lambda trong tài khoản đang chạm trần đồng thời.
resource "aws_cloudwatch_metric_alarm" "api_throttles" {
  alarm_name          = "${var.project}-api-lambda-throttles"
  alarm_description   = "Lambda api was throttled: account concurrency limit is exhausted"
  namespace           = "AWS/Lambda"
  metric_name         = "Throttles"
  dimensions          = { FunctionName = aws_lambda_function.api.function_name }
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.ops_alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "ingestion_failed" {
  alarm_name          = "${var.project}-ingestion-execution-failed"
  alarm_description   = "An import pipeline execution ended in a failed state"
  namespace           = "AWS/States"
  metric_name         = "ExecutionsFailed"
  dimensions          = { StateMachineArn = aws_sfn_state_machine.ingestion.arn }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.ops_alerts.arn]
}

# Cộng lỗi của 8 worker bằng metric math để dùng một alarm thay vì tám.
resource "aws_cloudwatch_metric_alarm" "worker_errors" {
  alarm_name          = "${var.project}-worker-errors"
  alarm_description   = "Worker Lambdas reported more than 3 errors in 15 minutes"
  evaluation_periods  = 1
  threshold           = 3
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.ops_alerts.arn]

  metric_query {
    id          = "total"
    expression  = join("+", [for index, name in local.worker_names : "e${index}"])
    label       = "Worker errors"
    return_data = true
  }

  dynamic "metric_query" {
    for_each = local.worker_names
    content {
      id = "e${metric_query.key}"
      metric {
        namespace   = "AWS/Lambda"
        metric_name = "Errors"
        dimensions  = { FunctionName = metric_query.value }
        stat        = "Sum"
        period      = 900
      }
    }
  }
}

# ---------- Dashboard ----------
locals {
  dashboard_region = var.aws_region
  api_dimensions   = ["ApiId", aws_apigatewayv2_api.api.id]
}

resource "aws_cloudwatch_dashboard" "overview" {
  dashboard_name = "${var.project}-overview"

  dashboard_body = jsonencode({
    widgets = [
      # Hàng 1 — Traffic
      {
        type = "metric", x = 0, y = 0, width = 12, height = 6
        properties = {
          title  = "API requests, 4xx, 5xx"
          region = local.dashboard_region
          view   = "timeSeries"
          stat   = "Sum"
          period = 300
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiId", aws_apigatewayv2_api.api.id, { label = "Requests" }],
            ["AWS/ApiGateway", "4xx", "ApiId", aws_apigatewayv2_api.api.id, { label = "4xx" }],
            ["AWS/ApiGateway", "5xx", "ApiId", aws_apigatewayv2_api.api.id, { label = "5xx" }],
          ]
        }
      },
      {
        type = "metric", x = 12, y = 0, width = 12, height = 6
        properties = {
          title  = "API latency (ms)"
          region = local.dashboard_region
          view   = "timeSeries"
          period = 300
          metrics = [
            ["AWS/ApiGateway", "Latency", "ApiId", aws_apigatewayv2_api.api.id, { stat = "p50", label = "p50" }],
            ["AWS/ApiGateway", "Latency", "ApiId", aws_apigatewayv2_api.api.id, { stat = "p95", label = "p95" }],
          ]
        }
      },
      # Hàng 2 — Compute
      {
        type = "metric", x = 0, y = 6, width = 8, height = 6
        properties = {
          title   = "Lambda invocations"
          region  = local.dashboard_region
          view    = "timeSeries"
          stat    = "Sum"
          period  = 300
          metrics = [for name in local.lambda_names : ["AWS/Lambda", "Invocations", "FunctionName", name]]
        }
      },
      {
        type = "metric", x = 8, y = 6, width = 8, height = 6
        properties = {
          title  = "Lambda errors and throttles"
          region = local.dashboard_region
          view   = "timeSeries"
          stat   = "Sum"
          period = 300
          metrics = concat(
            [for name in local.lambda_names : ["AWS/Lambda", "Errors", "FunctionName", name]],
            [["AWS/Lambda", "Throttles", "FunctionName", local.api_function_name]],
          )
        }
      },
      {
        type = "metric", x = 16, y = 6, width = 8, height = 6
        properties = {
          title   = "Lambda duration p95 (ms)"
          region  = local.dashboard_region
          view    = "timeSeries"
          stat    = "p95"
          period  = 300
          metrics = [for name in local.lambda_names : ["AWS/Lambda", "Duration", "FunctionName", name]]
        }
      },
      {
        type = "log", x = 0, y = 12, width = 24, height = 6
        properties = {
          title  = "Cold starts (Init Duration)"
          region = local.dashboard_region
          view   = "table"
          query = join(" | ", [
            "SOURCE '/aws/lambda/${local.api_function_name}'",
            "filter @type = \"REPORT\" and ispresent(@initDuration)",
            "stats count(*) as coldStarts, avg(@initDuration) as avgInitMs, max(@initDuration) as maxInitMs by bin(1h)",
            "sort @timestamp desc",
          ])
        }
      },
      # Hàng 3 — Pipeline
      {
        type = "metric", x = 0, y = 18, width = 12, height = 6
        properties = {
          title  = "Import pipeline executions"
          region = local.dashboard_region
          view   = "timeSeries"
          stat   = "Sum"
          period = 300
          metrics = [for metric in ["ExecutionsStarted", "ExecutionsSucceeded", "ExecutionsFailed", "ExecutionsTimedOut"] :
            ["AWS/States", metric, "StateMachineArn", aws_sfn_state_machine.ingestion.arn]
          ]
        }
      },
      {
        type = "metric", x = 12, y = 18, width = 12, height = 6
        properties = {
          title   = "Dead-letter queue depth"
          region  = local.dashboard_region
          view    = "timeSeries"
          stat    = "Maximum"
          period  = 60
          metrics = [for name in local.dlq_names : ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", name]]
        }
      },
      # Hàng 4 — Nghiệp vụ (EMF, namespace StockFlow). Tách thời lượng ra widget riêng vì
      # cộng dồn (Sum) thời lượng không có nghĩa.
      {
        type = "metric", x = 0, y = 24, width = 12, height = 6
        properties = {
          title   = "Business events"
          region  = local.dashboard_region
          view    = "timeSeries"
          stat    = "Sum"
          period  = 3600
          metrics = [for metric, service in local.business_counts : ["StockFlow", metric, "service", service]]
        }
      },
      {
        type = "metric", x = 12, y = 24, width = 12, height = 6
        properties = {
          title  = "Import commit duration (ms)"
          region = local.dashboard_region
          view   = "timeSeries"
          stat   = "Average"
          period = 3600
          metrics = [
            ["StockFlow", "ImportDurationMs", "service", "import-writer"],
          ]
        }
      },
    ]
  })
}
