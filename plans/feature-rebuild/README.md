# StockFlow Feature Rebuild Plan

Thư mục này là nguồn kế hoạch chính để gia cố và phát triển lại các chức năng của StockFlow Cloud.

## Mục tiêu

1. Làm cho README, kiến trúc và implementation khớp hoàn toàn.
2. Bảo đảm tồn kho không âm, không oversell và không bị cộng hai lần khi retry.
3. Áp dụng authorization theo role và chi nhánh ở backend.
4. Hoàn thiện event-driven recovery đúng nghĩa.
5. Xây dựng transfer fulfillment và serial tracking đủ sát nghiệp vụ kho điện tử.
6. Tạo demo, benchmark và bằng chứng kỹ thuật có thể sử dụng trong CV.

## Nguyên tắc

- Correctness trước feature mới.
- Backend authorization là nguồn sự thật; frontend chỉ điều chỉnh trải nghiệm.
- Ledger là audit source; inventory balance là projection phục vụ truy vấn.
- Không gọi một failure list/queue là DLQ nếu không có source queue và redrive policy.
- Terraform là nguồn sự thật hạ tầng đích; không để Terraform và SAM cùng sở hữu resource production.
- Mỗi phase chỉ hoàn thành khi code, test, tài liệu và vận hành đều đạt acceptance criteria.
- Không đưa số hiệu năng hoặc chi phí lên CV khi chưa đo và tái lập được.

## Quy ước phase

- `FR-*`: Feature Rebuild Plan trong thư mục này.
- `TF-*`: Terraform roadmap trong `infrastructure/TERRAFORM_PLAN.md`.

Luôn dùng prefix khi tạo issue, commit hoặc trao đổi để tránh nhầm hai hệ phase.

## Thứ tự thực hiện

| Phase | Nội dung                         | Phụ thuộc                   | Effort tham khảo              | Kết quả chính                                 |
| ----- | -------------------------------- | --------------------------- | ----------------------------- | --------------------------------------------- |
| FR-0  | Chốt phạm vi và baseline         | Không                       | 0.5–1 ngày                    | Quyết định kiến trúc, baseline test/build     |
| FR-1  | Inventory correctness            | FR-0                        | 3–5 ngày                      | Không oversell, không âm, human approval đúng |
| FR-2  | Authorization và quality gates   | FR-1                        | 3–5 ngày                      | Role/branch isolation, lint/test/CI pass      |
| FR-3  | Event-driven recovery            | FR-2, TF-2→TF-4             | 3–5 ngày ngoài phần Terraform | Report SQS/DLQ, import recovery, SFN retry    |
| FR-4  | Demo, observability và benchmark | FR-3, TF-2→TF-8 operational | 3–5 ngày ngoài phần Terraform | Demo sống, số đo thật, cost story             |
| FR-5  | Transfer fulfillment             | FR-2; nên sau FR-4          | 5–8 ngày                      | Pick, ship, receive, discrepancy              |
| FR-6  | Serial và warranty               | FR-5                        | 5–8 ngày                      | Truy xuất từng thiết bị và bảo hành           |

Rà soát, apply và debug TF-2→TF-8 ước tính thận trọng 7–12 ngày công. Thực tế stack đã từng apply và verify end-to-end ngày 2026-06-15 (frontend + API + database live) rồi chủ động destroy để tiết kiệm chi phí, nên tái lập theo runbook cũ khoảng 1–3 ngày — xem ghi chú bối cảnh trong [Terraform audit checklist](./terraform-audit-checklist.md).

Các con số trên là effort-day, không phải deadline. Với lịch ngoài giờ, tổng thời gian có thể vào khoảng 9–14 tuần tùy số giờ mỗi tuần.

Điểm dừng an toàn để đưa vào CV: hoàn thành FR-4.

Điểm nâng hạng domain: hoàn thành FR-5 và FR-6.

## Tài liệu

- [FR-0 — Decisions and baseline](./phase-0-decisions-and-baseline.md)
- [FR-1 — Inventory correctness](./phase-1-inventory-correctness.md)
- [FR-2 — Authorization and quality](./phase-2-authorization-and-quality.md)
- [FR-3 — Event-driven recovery](./phase-3-event-driven-recovery.md)
- [FR-4 — Demo, observability and benchmark](./phase-4-demo-observability-benchmark.md)
- [FR-5 — Transfer fulfillment](./phase-5-transfer-fulfillment.md)
- [FR-6 — Serial and warranty](./phase-6-serial-and-warranty.md)
- [Backlog](./BACKLOG.md)
- [Terraform audit checklist](./terraform-audit-checklist.md)

## Definition of Done toàn dự án

Một phase chỉ được đánh dấu hoàn thành khi:

- [ ] Acceptance criteria của phase đều pass.
- [ ] Có migration và rollback strategy nếu thay đổi database.
- [ ] Có test cho happy path, permission denial, concurrency/retry nếu liên quan.
- [ ] `npm run lint` pass.
- [ ] `npm test` pass và không có open handle.
- [ ] `npm run build` và `npm run build:lambdas` pass.
- [ ] `terraform fmt -check -recursive` và `terraform validate` pass nếu thay đổi IaC.
- [ ] README/API docs/architecture diagram đã cập nhật.
- [ ] Không phát sinh secret, state hoặc credential trong Git.

## Quy ước trạng thái

```text
[ ] Chưa làm
[~] Đang làm
[x] Hoàn thành và đã kiểm chứng
[!] Bị chặn, phải ghi lý do bên cạnh
```

Chỉ đổi sang `[x]` khi có bằng chứng kiểm thử hoặc vận hành tương ứng.

## Kiến trúc đích rút gọn

```text
Web
  → NestJS API
      → PostgreSQL/Aurora
      → report-jobs SQS → Report Lambda → S3
                            ↘ report-jobs-dlq

Browser → S3 imports
            → EventBridge
                → Step Functions
                    → Validator
                    → Parser
                    → Human approval
                    → Writer
                    → Import recovery event on terminal failure

Inventory commands
  → database transaction
      → Inventory balance
      → Stock movement ledger
      → Domain audit record
```

Transactional outbox được giữ trong backlog sau MVP. Không đưa vào critical path của FR-0–FR-4.

## Cut line

Critical path để đạt CV-ready:

```text
FR-0 → FR-1 → FR-2 → FR-3 + TF prerequisites → FR-4
```

Ngoài critical path:

- Big-bang refactor toàn dashboard.
- Full RMA.
- Purchase order.
- Bin location.
- Reconciliation analytics nâng cao.

Chỉ refactor component UI liên quan khi FR-5/FR-6 thực sự cần thay đổi chúng.
