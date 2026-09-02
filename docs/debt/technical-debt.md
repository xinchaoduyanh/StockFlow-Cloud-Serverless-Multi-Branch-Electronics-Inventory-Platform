# Nợ kỹ thuật (Technical Debt)

> Phạm vi: mọi thứ nằm trong repository — code, schema, test, thiết kế module.
> Rà soát lại ngày 2026-09-02 trên `main` tại commit `bd589a7`, sau khi E2 và E3 đã hoàn tất trong code.
> Mọi bằng chứng đã kiểm chứng bằng cách chạy lệnh trực tiếp, không dựa vào tài liệu có sẵn.

## Bảng tổng hợp

| ID    | Nợ                                                     | Mức | Effort (ngày) |
| ----- | ------------------------------------------------------ | --- | ------------- |
| TD-02 | 8 Lambda và toàn bộ frontend không có test nào         | P0  | 3–5           |
| TD-03 | 118 chỗ dùng `any`, và rule đã bị tắt nên không ai đếm | P1  | 2–3           |
| TD-06 | Hai đường import song song (S3 pipeline và local JSON) | P1  | 1–2           |
| TD-07 | Schema thiếu các bảng đỡ nghiệp vụ đích                | P1  | 3–5           |
| TD-08 | `Component.warrantyMonths` là dead field               | P1  | (gộp TD-07)   |
| TD-09 | Không có lịch sử giá vốn theo lô                       | P2  | 2–3           |
| TD-12 | Thiếu index cho truy vấn tra cứu chéo chi nhánh        | P2  | 0.5           |
| TD-13 | Không có ADR nào dù kế hoạch yêu cầu                   | P1  | 1             |
| TD-14 | Module `dlq/` vẫn tồn tại song song với `recovery/`    | P2  | 0.5           |

## Đã đóng trong đợt rà soát này

| ID    | Nợ cũ                                 | Đóng bởi                                                                       |
| ----- | ------------------------------------- | ------------------------------------------------------------------------------ |
| TD-01 | Lint fail 21 error / 202 warning      | `a1dc5c1` khai báo Node globals; `npm run lint --max-warnings=0` nay pass sạch |
| TD-04 | Module `dlq` không có DLQ nào         | `a1dc5c1` tạo 5 SQS queue thật kèm redrive policy. Xem TD-14 cho phần còn sót  |
| TD-05 | Ba service gọi Lambda fire-and-forget | `a1dc5c1` thay bằng `report-dispatcher` qua SQS + event source mapping         |
| TD-10 | `awsTaskToken` treo vĩnh viễn         | `a1dc5c1` thêm approval timeout và stale scan `rate(15 minutes)`               |
| TD-11 | Authorization chưa scope theo branch  | `343c514` thêm `AuthorizationPolicyService` áp lên toàn bộ controller          |

Không xoá các mục này khỏi lịch sử: chúng là bằng chứng cho thấy sổ nợ có tác dụng.

## Trạng thái kiểm chứng — 2026-09-02

| Lệnh                            | Kết quả                               |
| ------------------------------- | ------------------------------------- |
| `npm run format:check`          | PASS                                  |
| `npm run lint` (max-warnings=0) | PASS, 0 warning                       |
| `npm run typecheck`             | PASS (sau khi sửa TD-15 bên dưới)     |
| `npm test`                      | PASS — 13 suite, 43 test pass, 7 skip |
| `npm run build`                 | PASS                                  |
| `npm run build:lambdas`         | PASS                                  |
| `terraform fmt` + `validate`    | PASS                                  |

---

## TD-02 — 8 Lambda và toàn bộ frontend không có test nào

**Bằng chứng**

```
find apps packages -name "*.spec.ts"   →  11 file
find apps/lambdas  -name "*.spec.ts"   →  0 file
```

Toàn bộ 11 file test nằm trong `apps/api`. Con số đã khá hơn nhiều so với lần rà soát trước (8 suite / 19 test → 13 suite / 43 test), nhưng phân bố vẫn lệch hoàn toàn.

**Hậu quả:** phần được README gọi là "điểm sáng kỹ thuật cốt lõi" — Step Functions ingestion pipeline — vẫn là phần không có test. Parser stream Excel, validator kiểm header, writer commit batch 500 dòng trong transaction, và nay thêm `import-recovery-worker` xử lý partial batch failure: tất cả đều là logic dễ sai và đang không được bảo vệ.

TD-15 bên dưới là ví dụ trực tiếp: một lỗi kiểu trong `import-recovery-worker` tồn tại tới hôm nay vì thư mục `apps/lambdas` chưa từng được typecheck lẫn test.

**Cách sửa (ưu tiên theo thứ tự)**

1. `import-recovery-worker`: test partial batch failure — message hỏng phải nằm trong `batchItemFailures`, message tốt không được nằm trong đó.
2. `import-parser`: bảng đầu vào — thiếu cột, thừa cột, số âm, SKU trùng, ô rỗng, encoding lạ.
3. `import-writer`: idempotency — chạy lại cùng payload hai lần, khẳng định tồn kho không cộng đôi.
4. `report-exporter`: idempotency theo `exportJobId`.
5. Frontend: ưu tiên thấp nhất cho mục tiêu CV.

---

## TD-03 — 118 chỗ dùng `any`, và rule đã bị tắt

**Bằng chứng** — `eslint.config.mjs`:

```js
"@typescript-eslint/no-explicit-any": "off",
"no-console": "off",
```

Đếm thủ công trong mã nguồn (không tính `dist`, `node_modules`):

```
grep -rn ": any|<any>|as any" apps/api/src apps/lambdas apps/web/src packages/shared/src  →  118
grep -rn "console\." apps/lambdas                                                          →   59
```

**Hậu quả:** tắt rule khiến `npm run lint --max-warnings=0` pass, nhưng đổi lại 118 chỗ `any` từ "nợ đang được đếm" thành "nợ vô hình". Không có gì ngăn con số này tăng lên 200 mà không ai biết.

Với `no-console` thì đây còn là vấn đề vận hành: 59 lời gọi `console.*` trong Lambda là lý do OD-07 (thiếu structured logging) chưa giải quyết được — rule bị tắt nên không còn tín hiệu nào nhắc phải thay chúng bằng logger.

**Cách sửa:** đổi cả hai về `"warn"` và đặt trần trong CI bằng con số hiện tại (`--max-warnings=<n>`), rồi hạ dần theo từng PR. Cách này cho CI xanh ngay lập tức giống như tắt rule, nhưng giữ được khả năng đo. Ưu tiên xử lý trước các `as any` ở ranh giới API — nơi chúng che việc kiểu trả về không khớp contract trong `@stockflow/shared`.

---

## TD-06 — Hai đường import song song

**Bằng chứng** — `apps/api/src/imports/imports.controller.ts` vẫn còn 2 chỗ mô tả local mode:

```
"Create an import job. Rows are optional for local JSON preview mode."
"Attach rows and generate preview in local JSON mode."
```

Đường import thứ hai (client gửi thẳng JSON rows) vẫn chạy song song với pipeline S3 → EventBridge → Step Functions.

**Hậu quả:** logic normalize/validate tồn tại ở hai nơi. Sửa rule ở một đường mà quên đường kia thì hai lối vào cho ra hai kết quả khác nhau cho cùng một file. Đây là E1-12 vẫn đang mở trong backlog.

**Cách sửa — chọn một:** xoá hẳn local mode và cho mọi import đi qua S3; hoặc giữ nó làm đường test nhưng bắt buộc cả hai gọi chung một hàm normalize trong `packages/shared`.

---

## TD-07 — Schema thiếu các bảng đỡ nghiệp vụ đích

**Bằng chứng** — `apps/api/prisma/schema.prisma` nay có 14 model. Hai model mới (`ImportRecoveryItem`, `AuditLog`) phục vụ recovery, không phục vụ nghiệp vụ kho.

Thiếu so với hướng nghiệp vụ đã chốt:

| Thiếu                                                                  | Hậu quả                                                                                                                                              |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DemandSignal`                                                         | **Không thể đo được "mất doanh thu"**. Mọi con số doanh thu đưa lên CV sẽ là bịa — vi phạm nguyên tắc tự đặt trong `plans/feature-rebuild/README.md` |
| `InventoryUnit` + `InventoryUnitEvent`                                 | Không truy xuất được từng thiết bị, không tính được bảo hành                                                                                         |
| `TransferSuggestion`                                                   | Không có đề xuất tái phân bổ / giải phóng dead stock                                                                                                 |
| Trạng thái `IN_TRANSIT`                                                | Hàng mất trên đường giữa hai chi nhánh mà sổ sách vẫn cân                                                                                            |
| `TransferItem.pickedQuantity` / `shippedQuantity` / `receivedQuantity` | Không ghi nhận được nhận thiếu, vỡ, sai model                                                                                                        |

`TransferStatus` vẫn là `PENDING → APPROVED → COMPLETED`, tức duyệt xong coi như hàng đã tới nơi. Thực tế hàng đi nhà xe mất 1–2 ngày.

**Cách sửa:** thuộc phạm vi kế hoạch nghiệp vụ B1–B4, không phải hotfix. Ghi ở đây để sổ nợ phản ánh đúng khoảng cách giữa schema hiện tại và đích.

---

## TD-08 — `Component.warrantyMonths` là dead field

**Bằng chứng** — `apps/api/prisma/schema.prisma`: `warrantyMonths Int? @map("warranty_months")`.

Không model nào lưu ngày bán, không bảng nào theo dõi từng thiết bị. Bảo hành tính từ ngày nào? Áp cho cái nào trong 12 cái cùng SKU?

**Hậu quả:** field tồn tại trong schema, xuất hiện trong DTO, hiển thị trên UI — nhưng không trả lời được câu hỏi bảo hành nào. Tệ hơn thiếu field: nó tạo ảo giác tính năng đã có.

**Cách sửa:** gộp vào TD-07. Khi có `InventoryUnit`, tách thành `supplierWarrantyMonths` và `customerWarrantyMonths`, tính `warrantyEndsAt` tại thời điểm `SOLD`.

---

## TD-09 — Không có lịch sử giá vốn theo lô

**Bằng chứng** — `unitPrice Decimal?` là một giá trị đơn nhất trên `Component`.

**Hậu quả:** linh kiện PC (đặc biệt RAM, SSD, GPU) biến động giá theo tuần. Một `unitPrice` duy nhất nghĩa là không tính được lãi gộp thật, không định giá dead stock chính xác, không tính được mất giá theo thời gian.

**Cách sửa:** `InventoryUnit.costPrice` cho hàng có serial; cân nhắc `StockLot` (moving average) cho hàng không serial. **Cảnh báo phạm vi:** hướng này dễ kéo dự án sang kế toán — chỉ làm sau khi xong B1–B4.

---

## TD-12 — Thiếu index cho truy vấn tra cứu chéo chi nhánh

**Bằng chứng** — `apps/api/prisma/schema.prisma`:

```prisma
@@id([branchId, componentId])
```

Primary key là composite `(branch_id, component_id)`. Không có index riêng cho `component_id`.

**Hậu quả:** truy vấn cốt lõi của tính năng nghiệp vụ số một — _"SKU này còn hàng ở những chi nhánh nào?"_ — là `WHERE component_id = $1`, tức lọc theo **cột thứ hai** của composite key. PostgreSQL không dùng được B-tree đó, phải quét toàn bảng.

**Cách sửa:** thêm `@@index([componentId])` kèm migration. Phải làm **trước** khi build tính năng tra cứu chéo, không phải sau.

---

## TD-13 — Không có ADR nào

**Bằng chứng** — `docs/adr/` không tồn tại. `docs/README.md` vẫn liệt kê nó trong "suggested docs". Backlog E0-02 → E0-05 yêu cầu 4 ADR, tất cả đang `[ ]`.

Dự án hiện có rất nhiều tài liệu kế hoạch (`docs/plans/` có 4 thư mục, `plans/feature-rebuild/` có 9 file) nhưng **không có tài liệu quyết định nào**. Kế hoạch nói sẽ làm gì; ADR nói tại sao đã chọn cách này thay vì cách kia — và đó mới là thứ người phỏng vấn hỏi.

**Hậu quả:** những quyết định thiết kế tốt nhất của dự án đang vô hình. "Ledger là audit source, inventory balance là projection", "conditional atomic reservation thay vì optimistic locking", "Terraform là chủ sở hữu duy nhất, gỡ bỏ SAM" — cả ba đều là quyết định chín chắn, và cả ba đều chỉ nằm rải rác trong commit message.

**Cách sửa:** 4 ADR ngắn, mỗi cái nửa trang, format Context / Decision / Consequences. Đây là hạng mục **ROI cao nhất trên mỗi giờ bỏ ra** trong toàn bộ sổ nợ này.

---

## TD-14 — Module `dlq/` vẫn tồn tại song song với `recovery/`

**Bằng chứng** — cả hai thư mục cùng tồn tại trong `apps/api/src/`: `dlq/` và `recovery/`. Theo `EXECUTION-REPORT.md`, route `/admin/dlq/*` được giữ lại làm alias tương thích và delegate sang boundary recovery.

**Hậu quả:** nhẹ hơn TD-04 cũ rất nhiều vì DLQ nay là thật, nhưng vẫn còn hai tên gọi cho một khái niệm. Người đọc repo lần đầu sẽ mất thời gian tự hỏi hai module này khác nhau ở đâu.

**Cách sửa:** đặt hạn xoá alias (ví dụ sau khi frontend chuyển hết sang `/admin/recovery/*`), ghi hạn đó vào chính file `dlq.controller.ts`. Alias không có ngày hết hạn thì sẽ sống mãi.

---

## TD-15 — `apps/lambdas` chưa từng được typecheck (đã sửa 2026-09-02)

**Bằng chứng** — trước đợt này, không có script nào chạy `tsc` trên `apps/lambdas`:

- Root `lint` = `eslint .` — ESLint không kiểm tra kiểu.
- Workspace `lint` của `apps/api`/`apps/web` = `tsc --noEmit`, nhưng `apps/lambdas/*` không phải workspace (không có `package.json`).
- `esbuild` chỉ bóc bỏ type, không kiểm tra.

Nên khi thêm script `typecheck:lambdas`, lỗi lộ ra ngay:

```
apps/lambdas/import-recovery-worker/index.ts(155,14): error TS2322:
Type '(event: any) => Promise<{ status: string; ... } | { batchItemFailures: ... }>'
is not assignable to type 'SQSHandler'.
```

**Phân tích:** handler phục vụ **hai nguồn sự kiện**, xác nhận trong `serverless.tf`:

| Nguồn                                                                                              | Kỳ vọng                                                                                    |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `aws_lambda_event_source_mapping.import_recovery`                                                  | `function_response_types = ["ReportBatchItemFailures"]` → phải trả `{ batchItemFailures }` |
| `aws_cloudwatch_event_rule.import_recovery_scan` `rate(15 minutes)`, input `{"type":"stale-scan"}` | không có `Records`, giá trị trả về bị bỏ qua                                               |

Runtime **đúng**; chỉ có annotation `SQSHandler` là sai, và `event: any` che mất điều đó.

**Đã sửa:** thay `SQSHandler` bằng kiểu union tường minh cho cả hai nguồn sự kiện, giữ nguyên hành vi runtime, kèm comment giải thích hai nguồn. Thêm `typecheck:lambdas` vào `npm run typecheck` và vào CI để lỗi tương tự không lọt nữa.

**Bài học ghi lại:** đây chính là lý do TD-02 quan trọng. Một thư mục vừa không có test vừa không có typecheck thì `npm run lint` xanh không nói lên điều gì về nó.
