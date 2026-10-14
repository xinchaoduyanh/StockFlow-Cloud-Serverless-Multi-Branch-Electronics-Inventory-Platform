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

## Báo cáo vận hành hằng ngày

Lambda `stockflow-daily-ops-report` chạy 07:00 giờ Việt Nam (EventBridge Scheduler) và gửi email tóm tắt 24 giờ qua: request, 4xx/5xx, p50/p95, top endpoint, lỗi Lambda, cold start, DLQ, alarm đang ALARM, số liệu nghiệp vụ và chi phí ước tính. Tiêu đề cho biết trạng thái ngay: **Ổn**, **Cần xem** (có 5xx hoặc DLQ khác 0, hoặc thiếu dữ liệu ở phần quyết định) và **Có sự cố** (có alarm ở ALARM).

- Cần `ops_alert_email` (GitHub secret `OPS_REPORT_EMAIL`) và phải bấm link xác minh của SES sau lần apply đầu; SES sandbox chỉ gửi được tới địa chỉ đã xác minh.
- Chi phí ước tính cần bật **Receive Billing Alerts** ở Billing preferences; chưa bật thì email ghi `n/a`.
- Một nguồn dữ liệu lỗi không làm mất email: phần đó hiện "Không lấy được dữ liệu" và lý do nằm trong log của Lambda.
- Gửi thử không chờ 07:00 (chủ dự án chạy, dùng AWS credential): `aws lambda invoke --function-name stockflow-daily-ops-report --cli-binary-format raw-in-base64-out --payload '{}' /dev/null`.

## Ép lỗi 5xx để thử alarm thật

Đặt `enable_debug_endpoint = true` rồi apply (hoặc qua pipeline), gọi `GET /api/debug/fail` ít nhất 6 lần trong 5 phút; alarm `stockflow-api-5xx` chuyển ALARM và email về. Xong thì đặt lại `false` và apply: khi tắt endpoint trả 404.

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
