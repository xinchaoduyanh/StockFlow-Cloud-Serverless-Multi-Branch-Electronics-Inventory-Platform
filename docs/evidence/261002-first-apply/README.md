# Bằng chứng: apply lần đầu kiến trúc full serverless

Thư mục này gom bằng chứng cho P6 của plan [full serverless zero idle](../../plans/261002-full-serverless-zero-idle/SUMMARY.md). Repo public: **che account ID, ARN, IP, email, URL Neon** trong mọi ảnh và output trước khi commit.

## Checklist

| Bằng chứng                                              | File                           | Trạng thái |
| ------------------------------------------------------- | ------------------------------ | ---------- |
| `terraform plan` (đã che secret) và danh sách resource  | `terraform-plan.txt`           | [ ]        |
| `GET /api/health` trả commit SHA mới sau khi push       | `health-after-deploy.png`      | [ ]        |
| Message trong DLQ                                       | `dlq-message.png`              | [ ]        |
| Alarm ở trạng thái ALARM (và email cảnh báo)            | `alarm-in-alarm.png`           | [ ]        |
| Redrive từ DLQ thành công                               | `dlq-redrive.png`              | [ ]        |
| Alarm `api-5xx` chuyển ALARM khi gọi `/api/debug/fail`  | `api-5xx-alarm.png`            | [ ]        |
| X-Ray service map API → SQS → report-exporter → S3      | `xray-service-map.png`         | [ ]        |
| Dashboard `stockflow-overview` có số liệu               | `dashboard.png`                | [ ]        |
| Email báo cáo hằng ngày đầu tiên và ít nhất 2 sáng liền | `daily-report-1.png`, `-2.png` | [ ]        |
| Đo import 10k dòng: thời gian từng bước, cold start     | `import-10k-measurement.md`    | [ ]        |
| Hoá đơn AWS sau 7 ngày                                  | `billing-day-7.png`            | [ ]        |

## Cách ghi kết quả đo

`import-10k-measurement.md` phải đủ để người khác tái lập: commit SHA, kích thước file, cấu hình memory/timeout từng Lambda, số lần chạy, và số đo từng bước Step Functions. Không ghi số nào lên README hay CV nếu chưa có file này.
