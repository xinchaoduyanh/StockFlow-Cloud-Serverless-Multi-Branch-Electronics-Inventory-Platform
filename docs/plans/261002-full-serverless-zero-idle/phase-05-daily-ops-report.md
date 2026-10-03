# P5 — Email báo cáo vận hành hằng ngày

## Mục tiêu

07:00 mỗi sáng (giờ Việt Nam) chủ dự án nhận một email tóm tắt 24 giờ qua. Biết hệ thống có ai dùng không, có lỗi không, có tốn tiền không — mà không phải mở console.

## Luồng

```text
EventBridge Scheduler  cron(0 7 * * ? *)  timezone Asia/Ho_Chi_Minh
  └► Lambda daily-ops-report
        ├► CloudWatch GetMetricData   (traffic, lỗi, latency, DLQ, Lambda)
        ├► CloudWatch EstimatedCharges (us-east-1, chi phí tháng tới hiện tại)
        ├► Neon (Prisma, chỉ đọc)      (số liệu nghiệp vụ)
        └► SES SendEmail ─► email chủ dự án
```

Dùng **EventBridge Scheduler** thay vì EventBridge Rule vì Scheduler hỗ trợ múi giờ trực tiếp — không phải tự trừ 7 tiếng.

## Nội dung email

| Mục                                    | Nguồn                                  | Ví dụ                      |
| -------------------------------------- | -------------------------------------- | -------------------------- |
| Tổng request API                       | `AWS/ApiGateway` `Count`               | 1.284 (hôm trước: 960)     |
| Lỗi 4xx / 5xx                          | `4xx`, `5xx`                           | 37 / 2                     |
| Độ trễ p50 / p95                       | `Latency`                              | 180 ms / 2,1 s             |
| Top 5 endpoint nhiều request           | Logs Insights trên access log          | `GET /api/inventory` 412 … |
| Lambda lỗi / throttle                  | `AWS/Lambda` theo function             | `import-parser`: 1 lỗi     |
| Cold start                             | EMF hoặc Logs Insights `@initDuration` | 23 lần, trung bình 1,8 s   |
| Message đang nằm trong DLQ             | `ApproximateNumberOfMessagesVisible`   | 0 / 0 / 0                  |
| Alarm đang ở trạng thái ALARM          | `DescribeAlarms`                       | không có                   |
| Import: thành công / lỗi / dòng đã ghi | bảng `import_jobs`                     | 4 / 1 / 18.400             |
| Report đã xuất, transfer đã duyệt      | `export_jobs`, `transfers`             | 6, 3                       |
| Chi phí AWS tháng này                  | `AWS/Billing` `EstimatedCharges`       | $0.12                      |

Dòng đầu email là một trạng thái tổng: **Ổn**, **Cần xem** (có lỗi 5xx hoặc DLQ > 0) hoặc **Có sự cố** (có alarm đang ALARM). Đọc tiêu đề là biết có cần mở email không.

## Thay đổi

- `apps/lambdas/daily-ops-report/index.ts` (mới), thêm vào `esbuild.config.js` và `local.lambdas`.
- Template `DailyOpsReportEmail` trong `packages/shared`, cùng kiểu với `ImportSuccessEmail` và `ReconciliationAlertEmail` đang có, để tái dùng cách render TSX → HTML.
- Terraform:
  - `aws_scheduler_schedule` + role cho Scheduler gọi Lambda.
  - `aws_sesv2_email_identity` cho địa chỉ gửi và địa chỉ nhận (SES sandbox chỉ gửi được tới địa chỉ đã verify — đủ cho báo cáo gửi chính mình).
  - Biến `ops_report_email` (`sensitive`, lấy từ GitHub secret ở P3). Không commit email vào repo.
  - IAM: `cloudwatch:GetMetricData`, `cloudwatch:DescribeAlarms`, `logs:StartQuery`/`GetQueryResults`, `sqs:GetQueueAttributes`, `ses:SendEmail`, `ssm:GetParameter`.
- Test đơn vị cho phần tính trạng thái tổng và format số (không gọi AWS thật).

## Chi phí

~30 email/tháng qua SES, ~30 lần gọi `GetMetricData` với vài chục metric, 30 lần Logs Insights trên vài MB log — tất cả cỡ cent hoặc nằm trong free tier. Không dùng Cost Explorer API vì nó tính $0.01 mỗi lần gọi.

## Kiểm chứng

- [ ] Invoke thủ công Lambda → nhận email trong vài giây.
- [ ] Nhận email tự động 2 sáng liên tiếp, đúng 07:00 ICT.
- [ ] Khi có message trong DLQ, tiêu đề email chuyển sang "Cần xem".
