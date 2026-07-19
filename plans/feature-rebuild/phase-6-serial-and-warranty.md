# FR-6 — Serial and warranty

## Mục tiêu

Tạo bản sắc “electronics inventory” bằng truy xuất từng thiết bị và thời hạn bảo hành.

Full RMA workflow không nằm trong phase này.

## Data model

```text
InventoryUnit
- id
- componentId
- serialNumber
- barcode
- branchId
- status
- transferId?
- receivedAt
- warrantyStartsAt?
- warrantyExpiresAt?
- supplierReference?
- createdAt
- updatedAt
```

Status:

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

MVP có thể chỉ dùng:

```text
AVAILABLE
RESERVED
IN_TRANSIT
DEFECTIVE
```

## Invariant

- Serial number unique theo phạm vi đã chốt; ưu tiên unique toàn hệ thống.
- Với SKU quản lý serial, inventory balance phải khớp số InventoryUnit ở các trạng thái được tính là tồn.
- Thay đổi trạng thái serial phải tạo ledger/domain history.
- Không cho điều chỉnh aggregate quantity độc lập mà không xử lý serial units.
- Reconciliation kiểm tra ledger, inventory balance và InventoryUnit.

## Chức năng

- [ ] Đánh dấu component là serialized/non-serialized.
- [ ] Import serial bằng template/version riêng.
- [ ] Tạo serial khi goods received hoặc nhập kho.
- [ ] Tra cứu theo serial/barcode.
- [ ] Xem lifecycle/timeline.
- [ ] Reserve serial cụ thể hoặc allocate khi picking.
- [ ] Chuyển serial qua transfer fulfillment.
- [ ] Hiển thị warranty status.
- [ ] Đánh dấu defective với reason.

## Barcode

- [ ] Sinh barcode/QR từ serial hoặc internal unit ID.
- [ ] Camera scan trên web mobile.
- [ ] Không nhúng dữ liệu nhạy cảm trong barcode.
- [ ] Lookup vẫn áp dụng authorization theo branch.

## Warranty

- [ ] Warranty start rule: received date hoặc sold date, phải chọn rõ.
- [ ] Warranty expiry được tính hoặc lưu có kiểm soát.
- [ ] Hỗ trợ override có reason/audit.
- [ ] Cảnh báo sắp hết hạn nếu có use case.
- [ ] Tra cứu serial trả warranty status và lifecycle.

## Import/migration

- [ ] Component hiện tại mặc định `serialized=false`.
- [ ] Không bắt buộc backfill serial cho tồn kho cũ ngay.
- [ ] Nếu chuyển SKU sang serialized, phải có reconciliation/onboarding workflow.
- [ ] Template import từ chối duplicate serial.

## Test

- [ ] Duplicate serial bị từ chối.
- [ ] Serial không thuộc branch bị chặn.
- [ ] Một serial không thể AVAILABLE ở hai branch.
- [ ] Transfer chuyển đúng trạng thái serial.
- [ ] Aggregate balance khớp serial count.
- [ ] Retry không tạo duplicate InventoryUnit.
- [ ] Warranty calculation tại boundary date.

## Ngoài phạm vi

- Supplier repair workflow.
- Customer return portal.
- Replacement/refund accounting.
- Full RMA lifecycle.
- Bin-level tracking.

Các nội dung trên có thể trở thành FR-7 sau khi portfolio MVP hoàn thành.

## Acceptance criteria

- [ ] Có thể scan/nhập serial và biết thiết bị đang ở đâu.
- [ ] Có timeline từ nhập kho đến transfer hiện tại.
- [ ] Có warranty status đáng tin cậy.
- [ ] Aggregate inventory và serial units không trở thành hai nguồn sự thật độc lập.
- [ ] Demo thể hiện ít nhất một SKU serialized và một SKU non-serialized.

## Final portfolio refresh

FR-4 tạo bản demo CV-ready phiên bản đầu. Sau FR-6 cần dành thêm 0.5–1 ngày để:

- [ ] Quay lại video demo với transfer fulfillment và serial/warranty.
- [ ] Cập nhật architecture/domain diagram.
- [ ] Cập nhật ảnh UI/CloudWatch nếu flow thay đổi.
- [ ] Chạy lại benchmark nếu import/schema bị tác động.
- [ ] Cập nhật README và CV bullets.
