# Bổ sung chức năng và scout chức năng

> Tài liệu rà soát và đề xuất phát triển cho StockFlow Cloud.
>
> Mục tiêu: nâng dự án theo hai hướng song song:
>
> 1. Có chiều sâu kỹ thuật để trình bày trong CV và phỏng vấn.
> 2. Giải quyết đúng các vấn đề vận hành của kho điện tử nhiều chi nhánh.

## 1. Kết luận nhanh

StockFlow Cloud đã vượt mức một dự án CRUD thông thường. Dự án hiện có:

- Monorepo Next.js, NestJS và shared contracts.
- PostgreSQL/Prisma với inventory, reservation và stock movement ledger.
- AWS Lambda, Step Functions, S3, EventBridge, SNS.
- Terraform cho VPC, Aurora Serverless, ECS Fargate, ALB, CloudFront và serverless workers.
- Import Excel, transfer, reconciliation, reporting, notification và Cognito.

Điểm cần tập trung tiếp theo không phải bổ sung thêm thật nhiều công nghệ, mà là:

1. Làm cho mô tả kiến trúc khớp hoàn toàn với code.
2. Sửa các lỗ hổng authorization và tính nhất quán tồn kho.
3. Hoàn thiện một số quy trình nghiệp vụ từ đầu đến cuối.
4. Bổ sung kiểm thử, CI/CD, observability và benchmark có thể chứng minh.

Đánh giá tham khảo tại thời điểm scout:

| Khía cạnh                 | Đánh giá |
| ------------------------- | -------: |
| Ý tưởng kiến trúc         |     8/10 |
| Mức hoàn thiện kỹ thuật   |     6/10 |
| Ý nghĩa nghiệp vụ thực tế |     5/10 |
| Độ thuyết phục trên CV    |   6.5/10 |

## 2. Kết quả kiểm chứng hiện trạng

Các kiểm tra đã chạy trực tiếp trên repository:

| Hạng mục                         | Kết quả                        |
| -------------------------------- | ------------------------------ |
| Build API, web và shared package | Thành công                     |
| Build 8 Lambda workers           | Thành công                     |
| Test                             | 4 test suite, 11 test đều pass |
| Terraform validate               | Thành công                     |
| ESLint                           | Chưa đạt: 21 lỗi, 204 cảnh báo |
| Terraform format check           | Chưa đạt                       |
| GitHub Actions/CI                | Chưa có                        |
| Lambda unit/integration test     | Chưa có                        |
| Frontend test                    | Chưa có                        |

Lưu ý:

- Root command `npm run build` hiện chỉ build API, web và shared package. Lambda phải build riêng bằng `npm run build:lambdas`.
- Test đang có dấu hiệu rò timer/background worker khi teardown.
- Test reconciliation log ra lỗi do email service chưa hỗ trợ template `RECONCILIATION_ALERT`.

## 3. Scout chức năng hiện có

### 3.1. Inventory đa chi nhánh

Trạng thái: **Có nền tảng, cần gia cố**

Đã có:

- Tồn kho theo `branchId + componentId`.
- `quantity`, `reservedQuantity` và số lượng khả dụng được tính ở giao diện.
- Ngưỡng tồn thấp theo từng inventory record.
- Điều chỉnh tăng/giảm kho.
- Stock movement ledger.
- Trường `version` chuẩn bị cho optimistic locking.

Khoảng trống:

- Low-stock đang so sánh `quantity <= minStockThreshold`, chưa dùng số lượng khả dụng.
- Chưa có database constraint ngăn quantity/reservation âm.
- Điều chỉnh kho chưa yêu cầu reason code hoặc approval.
- Chưa có kho con, zone, rack, shelf hoặc bin location.
- Chưa có lot/batch/serial number.
- Chưa có lịch sử giá vốn.

Quy tắc nên áp dụng:

```text
available_quantity = quantity - reserved_quantity
low_stock = available_quantity <= min_stock_threshold
```

Database constraints đề xuất:

```sql
CHECK (quantity >= 0)
CHECK (reserved_quantity >= 0)
CHECK (reserved_quantity <= quantity)
CHECK (min_stock_threshold >= 0)
```

### 3.2. Chuyển kho

Trạng thái: **Có transaction cơ bản, workflow chưa sát thực tế**

Đã có:

- Tạo yêu cầu và reserve hàng tại kho gửi.
- Approve/reject/cancel.
- Transaction cập nhật hai chi nhánh.
- Ledger cho reservation, transfer in và transfer out.
- Lưu người tạo, người duyệt và người từ chối.

Khoảng trống:

- Approve hiện lập tức chuyển hàng sang `COMPLETED`.
- Chưa có picking, đóng gói, vận chuyển và xác nhận nhận hàng.
- Chưa có số lượng thực nhận, thiếu hàng, mất hàng hoặc hư hỏng.
- Chưa có người nhận xác nhận.
- Chưa có SLA/thời gian xử lý transfer.
- Trường `version` chỉ được tăng, chưa được dùng làm điều kiện optimistic locking.

State machine nghiệp vụ đề xuất:

```text
DRAFT
  → REQUESTED
  → APPROVED
  → PICKING
  → IN_TRANSIT
  → RECEIVED
  → COMPLETED

REQUESTED → REJECTED
REQUESTED/APPROVED → CANCELLED
IN_TRANSIT → PARTIALLY_RECEIVED
IN_TRANSIT → LOST_OR_DAMAGED
```

Nguyên tắc tồn kho:

- Khi request: tăng reservation tại kho gửi.
- Khi shipment rời kho: giảm physical quantity tại kho gửi.
- Khi receiver xác nhận: tăng quantity tại kho nhận.
- Chênh lệch phải tạo issue và cần người có quyền xử lý.

### 3.3. Import Excel

Trạng thái: **Là điểm sáng kỹ thuật nhưng đang có mâu thuẫn workflow**

Đã có:

- Direct upload bằng presigned S3 request.
- S3/EventBridge/Step Functions.
- Validator, streaming parser, staging rows và writer.
- Row-level validation.
- Preview và error rows.
- Task token của Step Functions.
- Batch commit theo chunk.
- Idempotency key và trạng thái từng row.

Khoảng trống:

- API có polling loop tự động confirm job `PREVIEW_READY`, làm mất ý nghĩa human-in-the-loop.
- Local import service và Lambda pipeline có logic parse/normalize/commit trùng nhau.
- Normalization giữa hai luồng có thể sai khác theo thời gian.
- Chưa có template versioning.
- Chưa có file lỗi tải về sau validation.
- Retry failed rows vẫn là placeholder.
- Chưa có test retry tại các điểm lỗi khác nhau.
- Chưa có benchmark file lớn thực tế.

Đề xuất:

- Bỏ auto-confirm hoặc đặt sau feature flag `IMPORT_AUTO_APPROVE=false`.
- Gom normalization và validation vào shared package.
- Ghi `templateVersion` trong import job.
- Cho tải CSV/XLSX chứa dòng lỗi và hướng dẫn sửa.
- Thêm checksum toàn file để phát hiện upload lặp.
- Test crash sau khi commit DB nhưng trước khi cập nhật job status.
- Công bố benchmark với 10.000, 50.000 và 100.000 dòng.

### 3.4. Reconciliation

Trạng thái: **Có nền tảng tốt**

Đã có:

- Scheduled Lambda.
- So sánh inventory với tổng ledger.
- Phát hiện orphaned movement.
- Tạo, cập nhật và auto-resolve reconciliation issue.
- Hỗ trợ dry run.

Khoảng trống:

- Thuật toán query aggregate theo từng inventory record tạo nguy cơ N+1 query.
- Chưa lưu bảng `ReconciliationRun` riêng để theo dõi một lần chạy.
- Chưa có snapshot/checkpoint ledger.
- Resolve issue có thể trực tiếp adjustment mà chưa có approval.
- Email template cho reconciliation chưa hoàn thiện.
- API reconciliation chưa được bảo vệ bằng admin role.

Đề xuất:

- Dùng một truy vấn `GROUP BY branch_id, component_id`.
- Thêm `ReconciliationRun` với duration, records scanned, mismatch count và status.
- Lưu người resolve, reason, evidence và action.
- Phân biệt `IGNORED`, `ADJUSTED`, `INVESTIGATING`, `RESOLVED`.

### 3.5. Reporting

Trạng thái: **Có async Lambda, mô tả queue chưa khớp**

Đã có:

- Export job.
- Lambda report exporter.
- Lưu file trên S3.
- Presigned download URL.
- Nhiều report type.

Khoảng trống:

- README mô tả SQS queue, nhưng API hiện invoke Lambda trực tiếp ở chế độ async.
- Chưa có retry queue/DLQ dành cho report.
- Chưa có access control theo người tạo hoặc chi nhánh.
- Chưa có retention policy và cleanup report cũ.
- Chưa có progress cho report lớn.

Quyết định cần chọn:

- Phương án A: thêm SQS thật, consumer Lambda và DLQ/redrive policy.
- Phương án B: giữ Lambda async invocation và sửa README cho đúng.

Nếu muốn tăng giá trị CV về event-driven architecture, ưu tiên phương án A.

### 3.6. DLQ và recovery

Trạng thái: **Tên gọi chưa phản ánh đúng implementation**

Hiện tại “DLQ” thực chất là:

- Query các import job có trạng thái `FAILED` hoặc `PARTIAL_FAILED`.
- Invoke replay Lambda hoặc reset job.
- Discard bằng cách chuyển trạng thái sang `CANCELLED`.

Repository chưa có:

- SQS queue.
- Dead-letter queue.
- Redrive policy.
- Message visibility timeout.
- Receive count.
- Poison-message handling.

Quyết định cần chọn:

- Triển khai SQS DLQ thật.
- Hoặc đổi tên giao diện thành `Failed Job Recovery`.

Không nên tiếp tục ghi “SQS DLQ” trên CV nếu chưa triển khai queue thật.

### 3.7. Authentication và authorization

Trạng thái: **Authentication tốt, authorization chưa đủ**

Đã có:

- Cognito JWT verification.
- Local user mapping.
- User status.
- Role enum.
- Admin guard cho user và branch management.

Rủi ro:

- Inventory, transfer, import, report, DLQ và reconciliation mới chỉ yêu cầu đăng nhập.
- Store manager có thể truyền `branchId` bất kỳ vào request.
- UI ẩn tab admin nhưng API chưa chặn đầy đủ.

Ma trận quyền đề xuất:

| Action                 | ADMIN |      WAREHOUSE |                   STORE_MANAGER |
| ---------------------- | ----: | -------------: | ------------------------------: |
| Xem mọi chi nhánh      |    Có | Tùy chính sách |                           Không |
| Xem chi nhánh của mình |    Có |             Có |                              Có |
| Điều chỉnh kho         |    Có |             Có |            Không hoặc cần duyệt |
| Tạo transfer           |    Có |             Có |    Có, chỉ từ/đến branch hợp lệ |
| Approve transfer       |    Có |             Có | Không tự duyệt request của mình |
| Confirm receiving      |    Có |             Có |              Có tại branch nhận |
| Import inventory       |    Có |             Có |            Theo branch được gán |
| Replay failed job      |    Có |          Không |                           Không |
| Chạy reconciliation    |    Có |          Không |                           Không |
| Quản lý user/branch    |    Có |          Không |                           Không |

Nên tạo `AuthorizationPolicyService` thay vì rải các câu lệnh kiểm tra role trong controller.

## 4. Các vấn đề kỹ thuật ưu tiên cao

### P0 — Phải sửa trước khi demo hoặc đưa vào CV

- [ ] Bỏ hoặc feature-flag auto-confirm import.
- [ ] Áp dụng role guard cho các API nhạy cảm.
- [ ] Áp dụng branch-level authorization ở service layer.
- [ ] Ngăn một người tự duyệt transfer của chính mình.
- [ ] Sửa optimistic locking/atomic reservation.
- [ ] Thêm database constraints cho quantity và reservation.
- [ ] Sửa low-stock theo available quantity.
- [ ] Sửa README để khớp SQS/DLQ/report implementation.
- [ ] Sửa lỗi email `RECONCILIATION_ALERT`.
- [ ] Sửa timer leak khi chạy test.
- [ ] Đưa ESLint về trạng thái pass.
- [ ] Chạy `terraform fmt`.

### P1 — Làm dự án đáng tin cậy

- [ ] Testcontainers với PostgreSQL thật.
- [ ] Integration test cho inventory transaction.
- [ ] Concurrency test cho hai transfer cùng reserve một SKU.
- [ ] Authorization test theo role và branch.
- [ ] Idempotency test cho import retry.
- [ ] Unit/integration test cho 8 Lambda.
- [ ] End-to-end test cho upload → preview → confirm → ledger.
- [ ] GitHub Actions cho lint, test, build và IaC validation.
- [ ] Gộp `build` và `build:lambdas` thành một quality gate.
- [ ] Dependency/security scan.
- [ ] Structured logging và correlation ID.
- [ ] CloudWatch alarms và dashboard.

### P2 — Tăng chiều sâu nghiệp vụ

- [ ] Transfer fulfillment nhiều bước.
- [ ] Serial number/IMEI/barcode.
- [ ] Warranty và RMA.
- [ ] Purchase order và goods receiving.
- [ ] Warehouse location/bin.
- [ ] Cycle count/stocktake.
- [ ] Adjustment reason và approval.
- [ ] Reorder policy và supplier lead time.
- [ ] Inventory valuation.
- [ ] ABC và dead-stock analytics.

## 5. Chức năng nên bổ sung

### 5.1. Serial number và barcode

Đây là chức năng có giá trị cao nhất để phân biệt kho điện tử với inventory app chung.

Data model gợi ý:

```text
InventoryUnit
- id
- componentId
- serialNumber
- barcode
- branchId
- binLocationId
- status
- receivedAt
- warrantyExpiresAt
- purchaseOrderItemId
```

Status gợi ý:

```text
AVAILABLE
RESERVED
IN_TRANSIT
SOLD
RETURNED
UNDER_REPAIR
DEFECTIVE
SCRAPPED
```

### 5.2. Warranty và RMA

Workflow:

```text
RMA_REQUESTED
→ RECEIVED_FROM_CUSTOMER
→ INSPECTING
→ SENT_TO_SUPPLIER
→ REPAIRED / REPLACED / REJECTED
→ RETURNED_TO_CUSTOMER
```

Giá trị thực tiễn:

- Truy xuất thiết bị theo serial.
- Kiểm tra thời hạn bảo hành.
- Biết thiết bị đang ở cửa hàng, trung tâm sửa chữa hay nhà cung cấp.
- Đo thời gian xử lý RMA.

### 5.3. Purchase order và receiving

Entities gợi ý:

```text
Supplier
PurchaseOrder
PurchaseOrderItem
GoodsReceipt
GoodsReceiptItem
QualityInspection
```

Workflow:

```text
DRAFT → SUBMITTED → APPROVED → ORDERED
→ PARTIALLY_RECEIVED → RECEIVED → CLOSED
```

Không cộng kho khi tạo purchase order. Chỉ cộng kho khi goods receipt được xác nhận.

### 5.4. Warehouse location

Hierarchy:

```text
Branch
└── Warehouse
    └── Zone
        └── Aisle
            └── Rack
                └── Bin
```

Nên hỗ trợ:

- Put-away.
- Move giữa các bin.
- Pick list.
- Barcode scan.
- Capacity hoặc loại hàng được phép lưu tại bin.

### 5.5. Cycle count

Entities:

```text
StocktakeSession
StocktakeAssignment
StocktakeCount
StocktakeVariance
```

Yêu cầu:

- Snapshot expected quantity khi bắt đầu.
- Người đếm không nhất thiết nhìn thấy expected quantity.
- Chênh lệch phải được duyệt.
- Adjustment tạo ledger và audit log.

### 5.6. Replenishment và analytics

Chỉ số nên có:

- Available stock.
- Days of inventory.
- Stockout rate.
- Inventory turnover.
- Slow-moving stock.
- Dead stock.
- Transfer lead time.
- Supplier lead time.
- Import success/error rate.
- Inventory accuracy sau cycle count.

Công thức reorder point cơ bản:

```text
reorder_point =
average_daily_demand × supplier_lead_time_days
+ safety_stock
```

## 6. Nâng cấp kiến trúc đề xuất

### 6.1. Consistency

- Atomic conditional update cho reserve inventory.
- Database constraints làm lớp bảo vệ cuối.
- Transaction isolation và retry cho serialization failure.
- Idempotency key ở cấp command/event.
- Unique constraint theo business reference.

### 6.2. Event-driven architecture

Nếu triển khai SQS:

```text
API
→ SQS
→ Worker Lambda
→ S3/Database
→ EventBridge/SNS
→ Notification consumers

SQS source queue
→ retry
→ SQS DLQ
→ recovery console
```

Nên cấu hình:

- Visibility timeout lớn hơn Lambda timeout.
- `maxReceiveCount`.
- Partial batch response.
- Message retention.
- Alarm khi DLQ có message.
- Replay có audit log.

### 6.3. Transactional outbox

Các thao tác vừa ghi database vừa phát notification có nguy cơ dual-write.

Đề xuất:

```text
Database transaction:
  update inventory
  insert stock movement
  insert outbox event

Outbox publisher:
  read unpublished event
  publish to EventBridge/SNS
  mark published
```

Đây là nâng cấp kỹ thuật tốt cho CV, nhưng chỉ nên làm sau P0.

### 6.4. Observability

Mỗi request/job nên có:

- `correlationId`.
- `userId`.
- `branchId`.
- `importJobId`, `transferId` hoặc `exportJobId`.
- Duration.
- Result/status.
- Error code.

Dashboard nên theo dõi:

- API p50/p95/p99 latency.
- API 4xx/5xx.
- Lambda errors, duration, throttles và cold starts.
- Step Functions failed/timed-out executions.
- SQS age of oldest message và DLQ depth.
- Database connection count.
- Import throughput và row error rate.

## 7. Kế hoạch triển khai đề xuất

### Sprint 0 — Truth and correctness

Mục tiêu: code, README và CV nói cùng một sự thật.

- Hoàn thiện P0.
- Viết lại capability list theo đúng implementation.
- Thêm ADR giải thích các quyết định kiến trúc chính.

Điều kiện hoàn thành:

- Lint pass.
- Test không leak.
- Terraform fmt/validate pass.
- Không có endpoint nhạy cảm chỉ dựa vào việc ẩn UI.
- Không thể làm quantity hoặc reservation âm.

### Sprint 1 — Reliability

Mục tiêu: chứng minh hệ thống chịu được lỗi và concurrency.

- Testcontainers PostgreSQL.
- Transfer concurrency test.
- Import idempotency/retry tests.
- CI pipeline.
- Structured logging và basic CloudWatch alarms.

Điều kiện hoàn thành:

- Pull request không thể merge nếu lint/test/build/IaC check fail.
- Hai request đồng thời không thể oversell.
- Retry cùng event không làm tăng kho hai lần.

### Sprint 2 — Transfer fulfillment

Mục tiêu: hoàn thiện một workflow nghiệp vụ thực tế.

- APPROVED, PICKING, IN_TRANSIT, RECEIVED.
- Pick/ship/receive permissions.
- Partial receiving và discrepancy issue.
- Ledger cho từng transition.
- Timeline trên giao diện.

### Sprint 3 — Electronics specialization

Mục tiêu: tạo bản sắc riêng cho dự án.

- Serial number.
- Barcode scan.
- Warranty expiration.
- RMA workflow.
- Tra cứu toàn bộ lifecycle của một thiết bị.

### Sprint 4 — Procurement and replenishment

- Supplier.
- Purchase order.
- Goods receipt.
- Bin put-away.
- Reorder suggestion.
- Supplier lead-time report.

### Sprint 5 — Portfolio hardening

- Load test import.
- Security review.
- Architecture diagram cập nhật.
- Demo seed data.
- Video demo 3–5 phút.
- Public API documentation.
- Benchmark report.
- Cost estimate theo lượng request.

## 8. Phạm vi MVP khuyến nghị

Nếu thời gian hạn chế, chỉ nên cam kết ba nhóm:

1. Authorization và inventory consistency.
2. Transfer `REQUESTED → IN_TRANSIT → RECEIVED`.
3. Serial number + warranty/RMA.

Ba nhóm này tạo ra câu chuyện CV rõ ràng:

```text
Một nền tảng kho điện tử đa chi nhánh
có consistency khi nhiều người thao tác,
có luồng giao nhận hai phía,
và truy xuất từng thiết bị theo serial trong toàn bộ vòng đời bảo hành.
```

## 9. Những thứ chưa nên ưu tiên

Chưa cần thêm chỉ để làm đẹp CV:

- Kubernetes.
- Kafka.
- Chia thành nhiều microservice.
- GraphQL nếu REST vẫn đáp ứng tốt.
- Machine learning forecasting khi chưa có dữ liệu demand thực.
- Multi-region active-active.
- Blockchain ledger.

Các công nghệ này làm tăng độ phức tạp nhưng không tự động tăng giá trị dự án. Nên ưu tiên correctness, testability và workflow thực tế trước.

## 10. Checklist trước khi đưa lên CV

### Kỹ thuật

- [ ] README không nói quá implementation.
- [ ] Build API/web/shared/Lambda bằng một command hoặc một CI workflow.
- [ ] Lint pass.
- [ ] Test pass và không leak.
- [ ] Terraform fmt/validate pass.
- [ ] Có concurrency test.
- [ ] Có idempotency test.
- [ ] Có authorization matrix test.
- [ ] Có deployment guide tái lập được.
- [ ] Không commit secret hoặc Terraform state.

### Nghiệp vụ

- [ ] Low-stock tính theo available quantity.
- [ ] Transfer cần xác nhận từ kho nhận.
- [ ] Adjustment có reason và actor.
- [ ] Có audit trail cho hành động nhạy cảm.
- [ ] Có cách xử lý partial failure.
- [ ] Có serial/warranty nếu định vị là kho điện tử.

### Portfolio

- [ ] Architecture diagram khớp hệ thống đang chạy.
- [ ] Có demo account cho từng role.
- [ ] Có sample import và expected output.
- [ ] Có video demo ngắn.
- [ ] Có benchmark với dữ liệu, cấu hình và cách tái lập.
- [ ] Có ảnh CloudWatch/Step Functions hoặc dashboard vận hành.
- [ ] CV chỉ ghi các con số đã đo.

## 11. Mẫu bullet CV sau khi hoàn thiện

Chỉ sử dụng sau khi các nội dung tương ứng đã được triển khai và kiểm chứng:

> Designed and deployed a multi-branch electronics inventory platform using NestJS, Next.js, PostgreSQL and AWS serverless services, supporting transactional stock transfers, serial-level traceability and role-scoped branch access.

> Built an idempotent Excel ingestion pipeline with S3, Step Functions and Lambda, processing `[N]` rows in `[T]` with row-level validation, human approval and safe retry.

> Prevented inventory overselling through atomic conditional updates, database constraints and concurrent integration tests.

> Implemented end-to-end stock transfer fulfillment from reservation and picking to in-transit tracking and receiver-confirmed delivery, backed by an immutable movement ledger.

Không điền `[N]` và `[T]` bằng ước lượng; phải lấy từ benchmark có thể chạy lại.

## 12. Các quyết định cần chốt khi rà soát kế hoạch

- [ ] Giữ SQS DLQ như một capability thật hay đổi tên thành failed-job recovery?
- [ ] Report export dùng SQS worker hay Lambda async invocation?
- [ ] Store manager có được điều chỉnh kho trực tiếp không?
- [ ] Ai có quyền approve transfer?
- [ ] Có cấm người tạo tự duyệt transfer không?
- [ ] Kho nhận có bắt buộc xác nhận hàng không?
- [ ] Theo dõi tồn kho theo SKU hay từng serial?
- [ ] Có triển khai purchase order trong phạm vi CV không?
- [ ] Có triển khai bin location/barcode trong phiên bản đầu không?
- [ ] Benchmark mục tiêu là 10.000, 50.000 hay 100.000 dòng?

Sau khi chốt các quyết định trên, nên chuyển roadmap thành GitHub issues/milestones và gắn mỗi issue với acceptance criteria cụ thể.

---

## 13. Kiểm chứng độc lập và phản biện (Claude — 2026-07-20)

> Phần này do reviewer thứ hai (Claude) bổ sung sau khi kiểm chứng trực tiếp các nhận định ở trên trên codebase. Mục đích: xác nhận độ tin cậy của tài liệu, điều chỉnh trọng số ưu tiên, và nêu các điểm cần Codex phản hồi để hai bản review hội tụ thành một kế hoạch duy nhất.

### 13.1. Kết quả kiểm chứng các nhận định chính

Tất cả nhận định nặng ký nhất của tài liệu đều **đúng với code hiện tại**:

| Nhận định của tài liệu                | Kết quả | Bằng chứng trong code                                                                                                                                                                       |
| ------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auto-confirm phá vỡ human-in-the-loop | Đúng    | `apps/api/src/imports/imports.service.ts:55-90` — polling loop `setTimeout` đệ quy tự động approve mọi job `PREVIEW_READY`                                                                  |
| Optimistic locking chưa tồn tại       | Đúng    | `version` chỉ được `increment` (`transfers.service.ts:134`), không bao giờ nằm trong điều kiện WHERE. Đoạn SQL trong README mục "Tối ưu 2" không tồn tại trong code                         |
| Race condition khi reserve            | Đúng    | `transfers.service.ts:106-136` là check-then-act: đọc quantity → kiểm tra available → update không điều kiện. Hai request đồng thời ở isolation mặc định (Read Committed) vẫn oversell được |
| API nhạy cảm chỉ cần đăng nhập        | Đúng    | `RolesGuard` chỉ gắn ở `users.controller.ts` và `branches.controller.ts`. Route `admin/dlq` (`dlq.controller.ts:11`) chỉ có `JwtAuthGuard` — mọi user đăng nhập đều replay/discard được     |
| Low-stock sai công thức               | Đúng    | `inventory.service.ts:46` so sánh `quantity <= minStockThreshold`, không dùng available quantity                                                                                            |
| SQS/DLQ không có thật                 | Đúng    | Không có SQS client nào trong toàn bộ `apps/`. DLQ là query DB theo status `FAILED/PARTIAL_FAILED`                                                                                          |
| Report không dùng queue               | Đúng    | `reports.service.ts:49-57` invoke Lambda trực tiếp (async, fallback sync), không có SQS                                                                                                     |
| Không có DB constraint                | Đúng    | `schema.prisma:148-162` (model Inventory) — không có CHECK nào ngăn quantity/reservation âm                                                                                                 |

Phát hiện bổ sung ngoài tài liệu gốc:

- **Low-stock còn có vấn đề hiệu năng**: `inventory.service.ts:35-48` fetch toàn bộ record khớp `where`, rồi filter và paginate (`slice`) trong memory. Với dữ liệu lớn đây là full-table scan mỗi lần gọi. Nên chuyển thành điều kiện SQL (`quantity - reserved_quantity <= min_stock_threshold`).
- **Timer leak khi test và auto-approve gần như chắc chắn là một vấn đề**: vòng `setTimeout` đệ quy trong `imports.service.ts` không có cơ chế dừng khi module destroy — chính nó là timer bị rò khi teardown. Xóa/flag polling loop giải quyết đồng thời hai mục P0.

### 13.2. Điểm đồng thuận

- Luận điểm cốt lõi của tài liệu là chính xác: **rủi ro lớn nhất không phải thiếu tính năng, mà là README tuyên bố những thứ code không làm** (optimistic locking, SQS DLQ, human-in-the-loop). Interviewer đọc repo 5 phút là thấy.
- Danh sách P0 đúng và đủ. Mục 9 (những thứ chưa nên làm) rất nên giữ nguyên.
- MVP 3 nhóm ở mục 8 là khung đúng.

### 13.3. Các điều chỉnh trọng số đề xuất

1. **SQS: nên làm thật, không đổi tên** — và triển khai bằng Terraform thay vì SAM. Dự án đang có sẵn roadmap Terraform 9 phase đang chạy dở (`infrastructure/TERRAFORM_PLAN.md`). Thêm SQS queue + DLQ + redrive policy vào roadmap đó là khối lượng nhỏ (~nửa ngày), biến hai claim trong README thành sự thật, và tạo chất liệu phỏng vấn tốt (visibility timeout vs Lambda timeout, maxReceiveCount, alarm DLQ depth). Chỉ chọn phương án đổi tên "Failed Job Recovery" nếu cần CV trong dưới 2 tuần.
2. **Demo-ability đang bị xếp ưu tiên quá thấp.** Video demo, seed data, demo account theo role đang nằm ở Sprint 5. Thực tế screening: người tuyển bấm link demo trước khi đọc code. Đề xuất kéo cụm "demo URL sống + 3 tài khoản theo role + video 3 phút + ảnh Step Functions console" lên ngay sau Sprint 1, trước cả testcontainers.
3. **Sprint 3 nên thu hẹp thêm**: làm serial number tracking + tra cứu lifecycle + warranty expiry trước; **hoãn full RMA workflow** (gửi supplier, sửa chữa, trả khách) sang giai đoạn sau. Serial tracking một mình đã đủ tạo bản sắc "kho điện tử" và demo trực quan. P2 hiện tại (PO + goods receipt + bin + cycle count + valuation + analytics) là khối lượng vài tháng — không khả thi cho phạm vi CV.
4. **Bổ sung một tài sản CV bị bỏ sót: câu chuyện chi phí.** Hạ tầng Terraform có thiết kế on/off (NAT gateway tắt được qua `system_on` flag). Nên đo và công bố cost breakdown khi bật/tắt trong README — "thiết kế hạ tầng tắt được để tiết kiệm $X/tháng khi không demo" là chi tiết interviewer AWS đánh giá cao.

### 13.4. Đề xuất trả lời cho 10 quyết định ở mục 12

| #   | Quyết định                              | Đề xuất                                                                                                                      |
| --- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | SQS DLQ thật hay đổi tên?               | Làm thật, qua Terraform (xem 13.3.1)                                                                                         |
| 2   | Report qua SQS hay Lambda async?        | SQS worker (phương án A), dùng chung hạ tầng queue với #1                                                                    |
| 3   | Store manager điều chỉnh kho trực tiếp? | Không — chỉ ADMIN/WAREHOUSE; store manager phải qua approval                                                                 |
| 4   | Ai approve transfer?                    | ADMIN và WAREHOUSE                                                                                                           |
| 5   | Cấm tự duyệt transfer của mình?         | Có, bắt buộc (separation of duties)                                                                                          |
| 6   | Kho nhận bắt buộc xác nhận?             | Có — đây là cốt lõi Sprint 2                                                                                                 |
| 7   | Theo SKU hay serial?                    | Hybrid: SKU-level quantity là nguồn sự thật vận hành; serial-level (InventoryUnit) phục vụ traceability, không thay thế nhau |
| 8   | Purchase order trong phạm vi CV?        | Chưa — giá trị-trên-công-sức thấp hơn serial/warranty                                                                        |
| 9   | Bin location/barcode bản đầu?           | Bin: chưa. Barcode lookup theo serial: có (rẻ một khi có InventoryUnit)                                                      |
| 10  | Benchmark mục tiêu?                     | 10.000 và 50.000 dòng bắt buộc; 100.000 nếu còn thời gian                                                                    |

### 13.5. Kế hoạch tuần đã điều chỉnh (thay cho Sprint 0-5 nếu Codex đồng ý)

| Tuần | Nội dung                                                                                                                                                                                                                                                                                                      | Điều kiện hoàn thành                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1    | Toàn bộ P0: xóa/flag polling auto-approve (kèm fix timer leak) → conditional UPDATE + CHECK constraints (raw SQL migration) → RolesGuard + branch-level check cho DLQ/reconciliation/imports/inventory/transfers → fix low-stock theo available (đẩy xuống SQL) → sửa README khớp code → lint + terraform fmt | Dự án "nói thật"; lint/test/fmt pass               |
| 2    | Concurrency test (2 transfer cùng reserve 1 SKU — test phải fail trước fix, pass sau fix), idempotency test cho import retry, GitHub Actions (lint + test + build + build:lambdas + terraform validate)                                                                                                       | PR không merge được nếu CI đỏ; không oversell được |
| 3    | Deploy demo theo Terraform roadmap + thêm SQS/DLQ thật + seed data + 3 demo account + video 3 phút + benchmark import 10k/50k dòng ghi số thật vào README                                                                                                                                                     | Có link demo sống và số đo tái lập được            |
| 4-5  | Transfer fulfillment (`APPROVED → IN_TRANSIT → RECEIVED`, partial receive + discrepancy issue) → serial number + warranty lookup                                                                                                                                                                              | Mỗi tính năng một câu chuyện CV riêng              |

Điểm dừng an toàn: hết tuần 3 dự án đã đủ điều kiện đưa lên CV (trung thực, có CI, có demo, có số đo). Tuần 4-5 là nâng hạng.

### 13.6. Câu hỏi gửi lại Codex

1. Có đồng ý gộp "timer leak" và "auto-approve" thành một root cause duy nhất (polling loop) và xử lý như một việc không?
2. Có đồng ý kéo cụm demo-ability (demo URL, seed, video) lên trước testcontainers/integration test như 13.3.2 không? Nếu không, lý do phản đối là gì?
3. Có đồng ý thu hẹp Sprint 3 thành "serial + warranty lookup", hoãn full RMA, như 13.3.3 không?
4. SQS triển khai qua Terraform (gắn vào `infrastructure/TERRAFORM_PLAN.md`) thay vì thêm vào SAM `template.yaml` — có xung đột gì với stack SAM hiện tại không, và nên để EventBridge → SQS hay API → SQS cho report flow?
5. Với 10 đề xuất ở 13.4, đánh dấu những điểm không đồng ý và nêu lý do.
6. Sau khi hội tụ, chuyển kế hoạch tuần ở 13.5 thành GitHub issues với acceptance criteria — Codex có thể draft luôn danh sách issue không?
