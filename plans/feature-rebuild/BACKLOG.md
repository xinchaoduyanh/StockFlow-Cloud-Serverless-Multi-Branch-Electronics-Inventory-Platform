# Feature Rebuild Backlog

Backlog này là bản nháp để chuyển thành GitHub issues sau khi chủ dự án duyệt kế hoạch.

## Epic E0 — Decisions and baseline

- [ ] E0-01 Ghi baseline build/test/lint/IaC.
- [ ] E0-02 Chốt inventory source-of-truth ADR.
- [ ] E0-03 Chốt atomic reservation ADR.
- [ ] E0-04 Chốt authorization matrix.
- [ ] E0-05 Chốt Terraform/SAM migration strategy.

## Epic E1 — Inventory correctness

- [x] E1-00 Dựng PostgreSQL integration test harness.
- [x] E1-01 Loại bỏ import auto-confirm polling.
- [x] E1-02 Fix timer lifecycle/open handles.
- [x] E1-03 Implement atomic conditional reservation.
- [x] E1-04 Thêm inventory CHECK constraints.
- [x] E1-05 Sửa low-stock theo available quantity.
- [x] E1-06 Đưa low-stock filtering/pagination xuống SQL.
- [x] E1-07 Chống duplicate import khi retry/event trùng.
- [ ] E1-08 Chuẩn hóa import idempotency.
- [x] E1-09 Thêm concurrency và retry tests.
- [x] E1-10 Fix reconciliation email template.
- [x] E1-11 Đồng bộ README với implementation.
- [ ] E1-12 Xóa local import mode hoặc hợp nhất normalization vào shared package.

## Epic E2 — Authorization and quality

- [ ] E2-01 Tạo AuthorizationPolicyService.
- [ ] E2-02 Scope inventory/import/report queries theo branch.
- [ ] E2-03 Bảo vệ DLQ/reconciliation bằng ADMIN.
- [ ] E2-04 Cấm transfer self-approval.
- [ ] E2-05 Thêm authorization matrix tests.
- [ ] E2-06 Fix lint.
- [ ] E2-09 Tạo CI quality gates.
- [ ] E2-D01 Refactor dashboard theo feature khi FR-5/FR-6 cần (deferred).

## Epic E3 — Event-driven recovery

- [ ] E3-01 Audit và migration SAM → Terraform.
- [ ] E3-02 Tạo report queue và DLQ.
- [ ] E3-03 Chuyển API report từ Lambda invoke sang SQS.
- [ ] E3-04 Làm report consumer idempotent.
- [ ] E3-05 Thêm DLQ alarms và recovery actions.
- [ ] E3-06 Thêm Step Functions retry/backoff.
- [ ] E3-07 Tạo import terminal failure recovery queue.
- [ ] E3-08 Audit replay/discard.
- [ ] E3-09 Hoàn thiện notification subscription bằng IaC.
- [ ] E3-10 Thêm approval timeout và stale-job cleanup qua fail-handler/scheduled recovery.

## Epic E4 — Demo and evidence

- [ ] E4-01 Deploy demo environment.
- [ ] E4-02 Seed realistic multi-branch data.
- [ ] E4-03 Tạo ba demo roles.
- [ ] E4-04 Thêm structured logging/correlation IDs.
- [ ] E4-05 Tạo dashboards và alarms.
- [ ] E4-06 Benchmark import 10k.
- [ ] E4-07 Benchmark import 50k.
- [ ] E4-08 Viết cost breakdown.
- [ ] E4-09 Quay video demo.
- [ ] E4-10 Cập nhật architecture diagram và CV bullets.

## Epic E5 — Transfer fulfillment

- [ ] E5-01 Migration transfer states/history.
- [ ] E5-02 Approve/reject policy.
- [ ] E5-03 Picking command.
- [ ] E5-04 Shipping command và ledger.
- [ ] E5-05 Receiving command và ledger.
- [ ] E5-06 Partial receiving/discrepancy.
- [ ] E5-07 Transfer timeline UI.
- [ ] E5-08 Transfer state/concurrency tests.

## Epic E6 — Serial and warranty

- [ ] E6-01 Migration InventoryUnit và serialized flag.
- [ ] E6-02 Serial import/creation.
- [ ] E6-03 Serial lifecycle history.
- [ ] E6-04 Serial allocation trong transfer.
- [ ] E6-05 Barcode/QR lookup.
- [ ] E6-06 Warranty calculation và override audit.
- [ ] E6-07 Serialized inventory reconciliation.
- [ ] E6-08 Serial/warranty demo.
- [ ] E6-09 Refresh final video, diagrams và CV assets.

## Epic E7 — Reconciliation hardening (ngoài critical path)

- [ ] E7-01 Thay N+1 aggregate bằng một truy vấn GROUP BY.
- [ ] E7-02 Thêm model ReconciliationRun.
- [ ] E7-03 Lưu duration, records scanned, mismatch count và run status.
- [ ] E7-04 Resolve issue có actor, reason và audit.
- [ ] E7-05 Xác định approval policy cho reconciliation adjustment.
- [ ] E7-06 Đồng bộ hoặc loại bỏ sync reconciliation fallback.
- [ ] E7-07 Benchmark reconciliation trên dataset lớn.

## Issue template đề xuất

Mỗi issue khi chuyển sang GitHub nên có:

```markdown
## Problem

## Scope

## Non-goals

## Technical design

## Migration/rollback

## Security and authorization

## Test cases

## Acceptance criteria

## Evidence
```

Không tạo issue theo tên công nghệ chung chung như “Add SQS”. Tên issue nên mô tả outcome, ví dụ:

> Route report jobs through an idempotent SQS worker with DLQ recovery
