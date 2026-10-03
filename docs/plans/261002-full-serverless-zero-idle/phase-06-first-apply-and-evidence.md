# P6 — Apply thật lần đầu và lưu bằng chứng

## Mục tiêu

Đưa toàn bộ hệ thống lên AWS lần đầu theo kiến trúc mới, chạy smoke test E3, lưu bằng chứng, và để demo chạy thường trực. Đóng OD-17.

## Điều kiện vào

- [ ] P0 đã apply: budget alert đang hoạt động, state bucket tồn tại.
- [ ] Đã kiểm tra gói Free Tier của tài khoản.
- [ ] Neon project ở ap-southeast-1 đã tạo, có pooled URL và direct URL.
- [ ] Đã trả lời 4 câu hỏi mở trong `SUMMARY.md`.

## Các bước

1. **Lần apply đầu chạy tay**, từ máy dev, để quan sát từng resource được tạo. Từ lần sau mọi thứ đi qua pipeline P3.
2. `prisma migrate deploy` + seed dữ liệu demo nhiều chi nhánh (3 chi nhánh, 3 tài khoản cho 3 role — E4-02, E4-03).
3. Trỏ DNS `api.` sang API Gateway.
4. Push một commit nhỏ để xác nhận pipeline deploy chạy trọn.
5. **Smoke test E3** theo `docs/runbooks/e3-recovery.md`:
   - tạo report job thành công;
   - ép report-exporter lỗi → message vượt `maxReceiveCount` → rơi vào DLQ;
   - alarm DLQ chuyển ALARM → có email;
   - redrive từ DLQ → job hoàn tất;
   - import lỗi ở bước parser → recovery item xuất hiện → replay thành công.
6. **Đo một lần** import 10k dòng: thời gian từng bước Step Functions, cold start. Ghi lại cấu hình đo để tái lập được.
7. Để hệ thống chạy 7 ngày, xem hoá đơn thật.

## Bằng chứng cần lưu vào `docs/evidence/261002-first-apply/`

- Ảnh: DLQ có message, alarm ở trạng thái ALARM, redrive thành công, X-Ray service map, dashboard có số liệu.
- Output `terraform plan` (đã che secret) và danh sách resource đã tạo.
- Email báo cáo hằng ngày đầu tiên.
- Kết quả đo import 10k và cold start.
- Ảnh hoá đơn AWS sau 7 ngày.

## Cập nhật tài liệu

- `README.md`: sơ đồ kiến trúc mới, bỏ toàn bộ hướng dẫn ECS/ALB/ECR, thêm link demo và ghi chú về cold start.
- `infrastructure/TERRAFORM_PLAN.md`: thêm chương full serverless.
- `docs/debt/`: đóng OD-02, OD-05, OD-06, OD-07, OD-08, OD-10, OD-11, OD-13, OD-14, OD-16, OD-17; cập nhật OD-04, OD-09, OD-12. Ghi một dòng vào lịch sử rà soát.
- `plans/feature-rebuild/BACKLOG.md`: tick E2/E3 đã xong trong code từ tháng 7 nhưng chưa được đánh dấu; tick E4-01→E4-06 nếu đạt.
- ADR-001: chuyển trạng thái sang **Accepted**, điền số cold start và chi phí thật.
- Runbook mới `docs/runbooks/rebuild-from-zero.md` (đóng OD-15).

## Kiểm chứng

Toàn bộ tiêu chí hoàn thành trong `SUMMARY.md`.
