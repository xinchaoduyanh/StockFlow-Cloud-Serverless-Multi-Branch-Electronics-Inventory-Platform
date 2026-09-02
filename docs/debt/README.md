# Debt Register — StockFlow Cloud

Sổ nợ của dự án, chia làm hai loại. Ranh giới phân loại:

| Loại                                          | Định nghĩa                                                                                         | Câu hỏi phân biệt                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [Nợ kỹ thuật](./technical-debt.md)            | Nằm **bên trong repository**: code, schema, test, kiểu dữ liệu, thiết kế module                    | "Sửa nó có phải mở file source ra không?"             |
| [Nợ hệ thống vận hành](./operational-debt.md) | Nằm **quanh việc chạy hệ thống trên AWS**: CI/CD, IaC, observability, security, chi phí, quy trình | "Sửa nó có phải chạm vào AWS/pipeline/runbook không?" |

## Nguyên tắc ghi nợ

1. Mỗi mục phải có **bằng chứng kiểm chứng được** (`file:line`, output lệnh, hoặc "không tồn tại" đã grep xác nhận).
2. Không ghi nợ dựa trên cảm giác. Không ghi nợ đã sửa xong — chuyển nó xuống mục "Đã đóng".
3. Mỗi mục phải nói rõ **hậu quả cụ thể**, không viết "không tốt cho maintainability".
4. `Effort` là effort-day ước tính, không phải deadline.
5. **Rà soát lại sổ nợ sau mỗi đợt commit lớn.** Sổ nợ lỗi thời còn tệ hơn không có sổ nợ.

## Thang mức độ

| Mức | Ý nghĩa                                                                                  |
| --- | ---------------------------------------------------------------------------------------- |
| P0  | Chặn việc đưa dự án lên CV / demo. Sai lệch giữa mô tả và thực tế, hoặc lỗ hổng bảo mật. |
| P1  | Làm dự án đáng tin cậy. Người phỏng vấn hỏi tới là lộ.                                   |
| P2  | Nâng chiều sâu. Không có cũng không sai.                                                 |

## Trạng thái kiểm chứng — 2026-09-02 (`main` @ `bd589a7`)

Tất cả đều chạy thật, không lấy từ tài liệu có sẵn:

| Hạng mục                            | Kết quả                                              |
| ----------------------------------- | ---------------------------------------------------- |
| `npm run format:check`              | PASS                                                 |
| `npm run lint` (`--max-warnings=0`) | PASS, 0 warning (nhưng 2 rule đã bị tắt — xem TD-03) |
| `npm run typecheck`                 | PASS (sau khi sửa TD-15)                             |
| `npm test`                          | PASS — 13 suite, 43 test pass, 7 skip                |
| `npm run build`                     | PASS                                                 |
| `npm run build:lambdas`             | PASS                                                 |
| `terraform fmt -check -recursive`   | PASS                                                 |
| `terraform validate`                | PASS                                                 |
| CI                                  | Có — `.github/workflows/quality.yml`                 |
| **E3 đã apply lên AWS chưa**        | **Chưa** — 128 resource chưa từng tồn tại            |

## Tổng quan số nợ

| Loại        | P0  | P1  | P2  | Tổng | Đã đóng đợt này |
| ----------- | --- | --- | --- | ---- | --------------- |
| Nợ kỹ thuật | 1   | 5   | 3   | 9    | 5               |
| Nợ vận hành | 4   | 10  | 2   | 16   | 1               |

## Ba mục đáng làm trước

1. **OD-17** — apply E3 lên AWS lần đầu. 128 resource hiện mới chỉ đúng cú pháp, chưa từng chạy.
2. **OD-04** — `PUSHER_SECRET` plaintext trong task definition. Rẻ nhất trong nhóm P0 và đã sống qua ba đợt commit lớn.
3. **TD-13** — viết 4 ADR. Dự án có rất nhiều tài liệu kế hoạch nhưng không có tài liệu quyết định nào.

## Liên hệ với các kế hoạch khác

- `plans/feature-rebuild/` — kế hoạch FR-0 → FR-6, tập trung vào **feature nghiệp vụ**.
- `docs/plans/` — kế hoạch thực thi theo đợt (E3 recovery, E4 demo evidence, Neon/NAT-less).
- `infrastructure/TERRAFORM_PLAN.md` — roadmap TF-\*.
- Sổ nợ này là góc nhìn ngược lại: **những gì đang thiếu hoặc sai ở cái đã có**.

## Lịch sử rà soát

| Ngày       | Mốc       | Ghi chú                                                                                   |
| ---------- | --------- | ----------------------------------------------------------------------------------------- |
| 2026-08-29 | `d7f7a7a` | Lập sổ lần đầu: 13 nợ kỹ thuật, 16 nợ vận hành                                            |
| 2026-09-02 | `bd589a7` | Rà soát lại sau E2/E3. Đóng 5 nợ kỹ thuật và 1 nợ vận hành; phát hiện TD-14, TD-15, OD-17 |
