# FR-0 — Decisions and baseline

## Mục tiêu

Chốt phạm vi và ghi lại trạng thái trước khi sửa để tránh thay đổi kiến trúc giữa chừng.

## Quyết định đã chốt

| Chủ đề               | Quyết định                                                      |
| -------------------- | --------------------------------------------------------------- |
| Import approval      | Human approval thật; auto-confirm mặc định bị loại bỏ           |
| Report processing    | API gửi SQS, Lambda consume, có DLQ/redrive                     |
| Import failure       | Dùng recovery/failure queue; chỉ gọi DLQ nếu có redrive thật    |
| IaC production       | Terraform là nguồn sự thật đích                                 |
| Inventory adjustment | ADMIN/WAREHOUSE; STORE_MANAGER gửi request nếu bổ sung workflow |
| Transfer approval    | ADMIN/WAREHOUSE, có branch policy                               |
| Self approval        | Cấm; admin override sau này phải có reason và audit             |
| Receiving            | Kho nhận bắt buộc xác nhận                                      |
| Serialized stock     | Hybrid SKU balance + InventoryUnit, có invariant/reconciliation |
| Purchase order       | Ngoài phạm vi CV đầu tiên                                       |
| Bin location         | Hoãn                                                            |
| Barcode              | Lookup/scan theo serial trong FR-6                              |
| Benchmark            | 10.000 và 50.000 dòng; 100.000 là mục tiêu mở rộng              |
| Full RMA             | Hoãn; FR-6 chỉ serial + warranty lookup                         |

## Baseline cần lưu

- [ ] Ghi Node, npm, Terraform và database engine version.
- [ ] Chạy và lưu kết quả `npm run build`.
- [ ] Chạy và lưu kết quả `npm run build:lambdas`.
- [ ] Chạy và lưu kết quả `npm test`.
- [ ] Chạy và lưu kết quả `npm run lint`.
- [ ] Chạy và lưu kết quả `terraform fmt -check -recursive`.
- [ ] Chạy và lưu kết quả `terraform validate`.
- [ ] Ghi danh sách endpoint và guard hiện tại.
- [ ] Ghi sơ đồ trạng thái import, transfer và report hiện tại.
- [ ] Ghi current Terraform state và phân biệt resource “đã viết code” với “đã apply”.
- [ ] Xác nhận cách gọi `FR-*` và `TF-*` trong issue/commit/tài liệu.

Baseline đã biết từ lượt scout:

| Check                | Baseline                      |
| -------------------- | ----------------------------- |
| API/web/shared build | Pass                          |
| Lambda build         | Pass                          |
| Tests                | 4 suites, 11 tests pass       |
| Lint                 | Fail: 21 errors, 204 warnings |
| Terraform validate   | Pass                          |
| Terraform format     | Fail                          |
| CI                   | Chưa có                       |

## ADR cần tạo trong quá trình triển khai

- [ ] ADR-001: Inventory balance, ledger và nguồn sự thật.
- [ ] ADR-002: Atomic reservation strategy.
- [ ] ADR-003: Branch authorization model.
- [ ] ADR-004: Report SQS/DLQ topology.
- [ ] ADR-005: Import recovery semantics.
- [ ] ADR-006: Terraform thay thế SAM production stack.
- [ ] ADR-007: Serialized inventory invariant.

ADR có thể đặt trong `docs/adr/` khi bắt đầu implementation.

## Không làm trong phase này

- Không sửa business logic.
- Không deploy/xóa AWS resource.
- Không thêm feature mới.

## Acceptance criteria

- [ ] Tất cả quyết định trong bảng đã được chủ dự án đồng ý.
- [ ] Baseline được ghi lại để so sánh sau mỗi phase.
- [ ] Không còn câu hỏi kiến trúc chặn FR-1.
