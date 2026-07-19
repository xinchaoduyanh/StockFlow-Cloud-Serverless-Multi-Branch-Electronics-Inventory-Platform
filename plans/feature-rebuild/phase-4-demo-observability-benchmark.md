# FR-4 — Demo, observability and benchmark

## Mục tiêu

Biến hệ thống đã đúng thành một portfolio có thể xem, đo và xác minh.

## Terraform prerequisites

FR-4 chỉ bắt đầu khi:

- [ ] TF-2 Network operational.
- [ ] TF-3 Database operational và đã migrate.
- [ ] TF-4 Serverless pipeline operational.
- [ ] TF-5 ECR/image build operational.
- [ ] TF-6 ECS/ALB health check pass.
- [ ] TF-7 frontend S3/CloudFront operational.
- [ ] TF-8 DNS/HTTPS smoke test pass.
- [ ] Không còn SAM/console resource cũ xung đột ownership.

## 1. Demo environment

- [ ] Deploy bằng Terraform theo runbook.
- [ ] Tạo demo domain/API domain.
- [ ] Seed dữ liệu đủ cho inventory, low-stock, transfer, import, report và reconciliation.
- [ ] Tạo ba demo account: ADMIN, WAREHOUSE, STORE_MANAGER.
- [ ] Credential demo không dùng cho production hoặc tài khoản cá nhân.
- [ ] Có script reset demo data.
- [ ] Có công tắc `system_on` và runbook bật/tắt.

## 2. Observability

Structured fields:

- [ ] `correlationId`.
- [ ] `userId`.
- [ ] `role`.
- [ ] `branchId`.
- [ ] `importJobId`, `transferId`, `exportJobId`.
- [ ] Duration, status và error code.

Dashboard:

- [ ] API latency/error rate.
- [ ] Lambda duration/errors/throttles.
- [ ] Step Functions failed/timed-out executions.
- [ ] SQS queue age và DLQ depth.
- [ ] Database connection count.
- [ ] Import rows/second và validation error rate.

Alarms:

- [ ] API 5xx.
- [ ] Lambda error/throttle.
- [ ] Step Functions failure.
- [ ] DLQ có message.
- [ ] Queue age vượt SLA.

## 3. Benchmark

Datasets bắt buộc:

- [ ] 10.000 dòng.
- [ ] 50.000 dòng.
- [ ] Mixed valid/invalid data.
- [ ] Duplicate/retry case.

Ghi lại:

- [ ] Cấu hình Lambda memory/timeout.
- [ ] Database configuration.
- [ ] File size.
- [ ] Parse time.
- [ ] Commit time.
- [ ] Total duration.
- [ ] Peak memory nếu đo được.
- [ ] Rows/second.
- [ ] Error rate.
- [ ] Chi phí ước tính/lần chạy nếu có dữ liệu đáng tin.

Không tối ưu trước khi có baseline benchmark.

## 4. Cost story

- [ ] Chụp/ghi cost khi hệ thống bật.
- [ ] Chụp/ghi cost khi `system_on=false`.
- [ ] Liệt kê tài nguyên vẫn phát sinh phí khi tắt.
- [ ] Dùng Cost Explorer/Infracost hoặc dữ liệu billing thật.
- [ ] Không ghi “zero cost” nếu ALB/storage/traffic vẫn tính phí.

## 5. Portfolio assets

- [ ] Video demo 3–5 phút.
- [ ] Architecture diagram khớp production.
- [ ] Ảnh Step Functions execution.
- [ ] Ảnh CloudWatch dashboard/alarms.
- [ ] API documentation.
- [ ] Benchmark report.
- [ ] Demo guide theo từng role.
- [ ] CV bullets chỉ dùng số đã đo.

## Acceptance criteria

- [ ] Reviewer có thể mở demo và hoàn thành flow chính.
- [ ] Ba role thể hiện permission khác nhau.
- [ ] Dashboard phát hiện được một failure được tạo có chủ đích.
- [ ] Benchmark 10k/50k có hướng dẫn tái lập.
- [ ] README có architecture, demo, benchmark và cost breakdown trung thực.
