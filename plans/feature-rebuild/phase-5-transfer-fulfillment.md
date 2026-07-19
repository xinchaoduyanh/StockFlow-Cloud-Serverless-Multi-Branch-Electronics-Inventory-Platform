# FR-5 — Transfer fulfillment

## Mục tiêu

Thay transfer “approve là hoàn thành” bằng workflow giao nhận hai phía.

## State model

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

Có thể bỏ `DRAFT` trong MVP nếu form tạo request đã atomic.

## Data model

Transfer cần thêm:

- [ ] `approvedAt`, `pickedAt`, `shippedAt`, `receivedAt`.
- [ ] `pickedBy`, `shippedBy`, `receivedBy`.
- [ ] Shipment reference/tracking code nếu cần.
- [ ] Expected và received quantity theo item.
- [ ] Discrepancy reason.
- [ ] State transition history.

Nên dùng bảng history:

```text
TransferStatusHistory
- transferId
- fromStatus
- toStatus
- actorId
- reason
- metadata
- createdAt
```

## Inventory semantics

- REQUESTED: reserve kho gửi.
- APPROVED/PICKING: giữ reservation.
- IN_TRANSIT: giảm physical quantity và reservation ở kho gửi.
- RECEIVED: tăng physical quantity ở kho nhận theo số thực nhận.
- PARTIALLY_RECEIVED: phần thiếu tạo discrepancy.
- CANCEL trước shipment: release reservation.
- Không cancel đơn giản sau shipment; phải dùng return/reversal flow.

## Commands

- [ ] Request transfer.
- [ ] Approve/reject.
- [ ] Start picking.
- [ ] Mark shipped.
- [ ] Confirm receiving.
- [ ] Record partial receiving.
- [ ] Resolve discrepancy.

Mỗi command cần:

- Expected current state.
- Actor policy.
- Idempotency key.
- Transaction.
- Ledger movements.
- Audit/status history.

## Authorization

- Người tạo không tự approve.
- Kho gửi/warehouse thực hiện picking và shipping.
- Kho nhận xác nhận receiving.
- Chỉ admin xử lý discrepancy nhạy cảm.
- User không thuộc branch gửi/nhận không được đọc transfer.

## API/UI

- [ ] Timeline trạng thái.
- [ ] Action button theo role và state.
- [ ] Pick list.
- [ ] Receiving form với expected/actual.
- [ ] Discrepancy badge và resolution view.
- [ ] Realtime notification cho state transition.

## Test

- [ ] Happy path toàn bộ state.
- [ ] Invalid state transition.
- [ ] Self approval denied.
- [ ] Wrong branch denied.
- [ ] Duplicate ship/receive command.
- [ ] Partial receiving.
- [ ] Cancel trước và sau shipment.
- [ ] Transaction rollback khi ledger write lỗi.
- [ ] Concurrency hai actor cùng transition.

## Acceptance criteria

- [ ] Approve không còn cộng kho nhận ngay.
- [ ] Kho nhận chỉ tăng khi receiver xác nhận.
- [ ] Mọi state transition có actor và timestamp.
- [ ] Partial/lost/damaged không làm mất dấu chênh lệch.
- [ ] Ledger và inventory reconciliation vẫn khớp.
