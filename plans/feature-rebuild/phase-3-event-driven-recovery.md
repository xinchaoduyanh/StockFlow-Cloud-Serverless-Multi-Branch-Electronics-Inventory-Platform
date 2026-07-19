# FR-3 — Event-driven recovery

## Mục tiêu

Làm cho report queue, DLQ, import retry và recovery đúng nghĩa kỹ thuật và đúng với README.

## Terraform prerequisites

FR-3 không tự dựng toàn bộ hạ tầng nền. Trước khi apply resource mới:

- [ ] TF-2 Network đã được `plan/apply` và smoke-test.
- [ ] TF-3 Aurora/Secrets đã được `plan/apply`; migration chạy được.
- [ ] TF-4 serverless ownership đã được audit/migrate khỏi SAM.
- [ ] Current Terraform state đã được xác nhận; không dựa vào state backup.
- [ ] `terraform plan` không đề xuất xóa/thay thế resource ngoài dự kiến.

Xem [Terraform audit checklist](./terraform-audit-checklist.md).

## 1. IaC ownership

- [ ] Xác nhận Terraform là production source of truth.
- [ ] Liệt kê resource còn thuộc SAM/CloudFormation.
- [ ] Chọn import vào Terraform hoặc decommission stack SAM cũ.
- [ ] Không apply hai stack sở hữu cùng bucket, Lambda, rule hoặc state machine.
- [ ] Ghi runbook migration và rollback.

## 2. Report queue

Topology:

```text
API
  → create ExportJob(PENDING)
  → SendMessage(report-jobs)

report-jobs
  → Report Lambda
      → PROCESSING
      → S3
      → COMPLETED/FAILED

maxReceiveCount exceeded
  → report-jobs-dlq
```

Terraform resources:

- [ ] `aws_sqs_queue.report_jobs`.
- [ ] `aws_sqs_queue.report_jobs_dlq`.
- [ ] Redrive policy.
- [ ] Lambda event source mapping.
- [ ] Least-privilege IAM.
- [ ] CloudWatch alarm khi DLQ depth > 0.
- [ ] Queue age alarm.

Implementation:

- [ ] API dùng SQS client thay Lambda invoke trực tiếp.
- [ ] Message chỉ chứa job ID và metadata tối thiểu.
- [ ] Lambda hỗ trợ partial batch failure.
- [ ] Visibility timeout lớn hơn Lambda timeout.
- [ ] Consumer idempotent theo `exportJobId`.
- [ ] Presigned download vẫn chỉ cấp cho user hợp lệ.

## 3. Report recovery console

- [ ] List failed export jobs từ database.
- [ ] Hiển thị DLQ metadata an toàn, không lộ payload nhạy cảm.
- [ ] Redrive/replay có audit.
- [ ] Discard có reason.
- [ ] Không cho replay vô hạn.

## 4. Step Functions retry

Thêm retry theo loại lỗi:

- [ ] Transient AWS/network/database errors: exponential backoff + jitter.
- [ ] Validation/business errors: không retry.
- [ ] Timeout rõ cho approval task.
- [ ] Catch terminal error và cập nhật ImportJob.
- [ ] Chuyển stale-job cleanup sang approval timeout + fail-handler hoặc scheduled recovery Lambda; không dùng polling trong API.
- [ ] Không nuốt lỗi rồi trả trạng thái thành công giả.

## 5. Import recovery queue

Giữ pipeline chính:

```text
S3 → EventBridge → Step Functions
```

Terminal failure:

```text
Step Functions FAILED/TIMED_OUT/ABORTED
  → EventBridge status event
  → import-recovery queue
  → recovery dashboard/worker
```

- [ ] Gọi đúng tên `Import Recovery Queue`, không gọi DLQ nếu không có redrive.
- [ ] Correlate execution ARN với ImportJob.
- [ ] Replay tạo execution mới với idempotency guard.
- [ ] Lưu số lần replay, actor và reason.
- [ ] Alarm khi recovery queue có item chưa xử lý.

## 6. Notifications

- [ ] Terraform tạo subscription/consumer cần thiết cho notification topic.
- [ ] Không phụ thuộc cấu hình thủ công không được ghi lại.
- [ ] Notification failure không rollback inventory transaction.
- [ ] Có retry/recovery riêng cho notification nếu cần.

Transactional outbox được hoãn trừ khi dual-write thực sự gây lỗi trong test.

## Acceptance criteria

- [ ] Report API không invoke Lambda trực tiếp.
- [ ] Report message lỗi vượt retry được đưa vào DLQ thật.
- [ ] DLQ replay không tạo duplicate report.
- [ ] Step Functions có retry/backoff cho transient failure.
- [ ] Import terminal failure xuất hiện trong recovery workflow.
- [ ] Terraform là owner duy nhất của production resources liên quan.
- [ ] README dùng đúng thuật ngữ queue, DLQ và recovery.
