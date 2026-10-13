# Runbook: quan sát hệ thống

Dashboard `stockflow-overview` (CloudWatch → Dashboards) gồm bốn hàng: traffic, compute, pipeline, nghiệp vụ. Mọi alarm gửi về SNS topic `stockflow-ops-alerts`.

## Nhận email cảnh báo

Đặt GitHub secret `OPS_REPORT_EMAIL` (hoặc `ops_alert_email` trong `terraform.tfvars` khi apply tay). Sau lần apply đầu, mở email từ AWS Notifications và bấm **Confirm subscription**; chưa xác nhận thì không nhận được gì.

## Lần theo một lần import hoặc một request

CloudWatch → Logs Insights, chọn log group của `stockflow-api` và các worker `stockflow-import-*`, `stockflow-report-exporter`:

```text
fields @timestamp, service, level, message
| filter correlationId = "<importJobId hoặc x-correlation-id>"
| sort @timestamp asc
```

- Request qua API: client nhận `x-correlation-id` trong response header; gửi header này lên để tự đặt ID.
- Import: `correlationId` của các worker chính là `importJobId`.
- Report: API gắn `correlationId` vào message attribute của SQS; worker cũng rơi về `exportJobId`.

## Xem trace

CloudWatch → X-Ray traces → Service map. Mong đợi thấy API Gateway → `stockflow-api` → SQS → `stockflow-report-exporter` → S3.

## Thử alarm mà không cần gây lỗi thật

Lệnh này ghi vào AWS nên chỉ chủ dự án chạy:

```bash
aws cloudwatch set-alarm-state --alarm-name stockflow-api-5xx --state-value ALARM --state-reason "manual test"
```

Alarm tự về `OK` ở lần đánh giá kế tiếp. Cách này kiểm tra đường alarm → SNS → email, không kiểm tra ngưỡng của metric.

## Chi phí (ước tính, lưu lượng demo)

| Resource                        | Số lượng | Ghi chú                                    |
| ------------------------------- | -------- | ------------------------------------------ |
| CloudWatch alarm                | 9        | free tier 10 alarm                         |
| CloudWatch dashboard            | 1        | free tier 3 dashboard                      |
| Custom metric (EMF)             | 6        | free tier 10 metric, 1 dimension `service` |
| SNS topic + 1 email             | 1        | email miễn phí                             |
| X-Ray (Lambda + Step Functions) | -        | free tier 100k trace/tháng                 |
