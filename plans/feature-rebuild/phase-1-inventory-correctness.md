# FR-1 — Inventory correctness

## Mục tiêu

Sửa các lỗi có thể làm sai tồn kho và khôi phục đúng human-in-the-loop.

## 0. Real PostgreSQL test harness

Đây là prerequisite để bắt đầu và nghiệm thu FR-1. Prisma mock không thể chứng minh row locking, isolation level hoặc database CHECK constraint.

- [ ] Chọn Testcontainers hoặc Docker Compose PostgreSQL.
- [ ] Chạy Prisma migrations thật trên database test.
- [ ] Seed fixture tối thiểu cho branch, component và inventory.
- [ ] Mỗi test có isolation/cleanup deterministic.
- [ ] CI ở FR-2 có thể chạy lại cùng harness.
- [ ] Không dùng database development/production cho integration test.

Các test bắt buộc chạy trên PostgreSQL thật:

- Hai transaction đồng thời reserve cùng SKU.
- Database từ chối quantity/reservation vi phạm CHECK.
- Transaction nhiều items rollback toàn bộ.
- Import retry không commit cùng row hai lần.

## 1. Loại bỏ auto-confirm và timer leak

- [ ] Xóa polling auto-confirm khỏi `ImportsService`.
- [ ] Import chỉ tiếp tục khi endpoint confirm được người có quyền gọi.
- [ ] Nếu cần demo auto mode, dùng feature flag mặc định `false`.
- [ ] Nếu còn timer nền, implement `OnModuleDestroy` và `clearTimeout`.
- [ ] Test xác nhận job `PREVIEW_READY` không tự chuyển trạng thái.
- [ ] Test confirm/cancel task token.

## 2. Atomic inventory reservation

Thay check-then-act bằng conditional update. ADR-002 phải chọn chiến lược cụ thể; không mặc định kết hợp mọi cơ chế locking.

```text
UPDATE inventory
SET reserved_quantity = reserved_quantity + requested,
    version = version + 1
WHERE branch_id = ?
  AND component_id = ?
  AND quantity - reserved_quantity >= requested;
```

- [ ] Với reserve đơn giản, ưu tiên invariant-based conditional update.
- [ ] Chỉ thêm `version = expected_version` khi command thực sự phụ thuộc stale snapshot.
- [ ] Chọn optimistic locking + bounded retry hoặc Serializable transaction cho command nhiều row/phức tạp.
- [ ] Không reserve từng item theo cách có thể tạo partial state ngoài transaction.
- [ ] Chuẩn hóa error `INVENTORY_CONFLICT` và `INSUFFICIENT_AVAILABLE_STOCK`.
- [ ] Thêm concurrency test hai transfer tranh cùng một SKU.
- [ ] Test transaction nhiều item rollback toàn bộ khi một item thiếu.

## 3. Database constraints

Tạo Prisma migration chứa raw SQL:

```sql
CHECK (quantity >= 0)
CHECK (reserved_quantity >= 0)
CHECK (reserved_quantity <= quantity)
CHECK (min_stock_threshold >= 0)
```

- [ ] Audit và sửa dữ liệu vi phạm trước khi add constraint.
- [ ] Đặt tên constraint rõ ràng.
- [ ] Ghi rollback SQL.
- [ ] Test database từ chối update vi phạm.

## 4. Low-stock đúng và phân trang tại database

Điều kiện:

```text
quantity - reserved_quantity <= min_stock_threshold
```

- [ ] Không fetch toàn bộ rồi `.filter().slice()` trong memory.
- [ ] Lọc, sort và paginate tại PostgreSQL.
- [ ] Trả metadata `page`, `pageSize`, `total`.
- [ ] Test trường hợp quantity cao nhưng phần lớn đã reserved.
- [ ] Benchmark query trước khi quyết định thêm index/generated column.

## 5. Import idempotency

- [ ] Một import row đã `COMMITTED` không được commit lại.
- [ ] Cùng một task/event retry không tăng inventory hai lần.
- [ ] Kiểm tra uniqueness của idempotency key ở database.
- [ ] Thống nhất thuật toán idempotency giữa API local mode và Lambda.
- [ ] Test crash sau DB commit nhưng trước khi cập nhật parent job.
- [ ] Xác định semantics của `PARTIAL_FAILED` và retry failed chunks.

## 6. Hợp nhất hoặc loại bỏ local import mode

API local mode và Lambda production mode đang tự parse/normalize riêng.

- [ ] Xác nhận frontend/runtime có còn sử dụng `/imports/upload`, `/init`, `/start`.
- [ ] Nếu không có use case thật: xóa local import mode và các route liên quan.
- [ ] Nếu phải giữ: extract header/value normalization vào shared package.
- [ ] Một fixture phải cho kết quả normalized data giống nhau ở mọi adapter.
- [ ] Không duy trì hai implementation business rule độc lập.

Ưu tiên mặc định: xóa local mode nếu production frontend không dùng nó.

## 7. Lỗi liên quan

- [ ] Bổ sung email template hoặc routing hợp lệ cho `RECONCILIATION_ALERT`.
- [ ] Không để background email error làm nhiễu test pass.
- [ ] Sửa README human-in-the-loop, optimistic locking và low-stock theo code mới.

## Migration/rollback

- Migration phải chạy trên bản sao dữ liệu trước.
- Nếu constraint fail, xuất các record vi phạm thay vì tự sửa âm thầm.
- Rollback application không được chạy với schema thiếu constraint mà code mới đang phụ thuộc.

## Acceptance criteria

- [ ] Hai request đồng thời không thể oversell.
- [ ] Inventory, reserved quantity không thể âm ở cả service và database.
- [ ] Low-stock dựa trên available quantity và phân trang tại DB.
- [ ] Import không tự approve.
- [ ] Retry cùng command/event không cộng kho hai lần.
- [ ] Test không còn open handle do polling loop.
- [ ] PostgreSQL integration tests chạy thật và không dùng Prisma mock cho các invariant.
- [ ] Chỉ còn một nguồn logic parse/normalize hoặc có shared implementation được kiểm chứng.
