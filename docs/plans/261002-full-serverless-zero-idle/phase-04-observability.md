# P4 — Observability không cần server

## Mục tiêu

Có đủ bốn trụ quan sát — metrics, logs, traces, alerting — cộng dashboard, mà không chạy một server nào.

## Prometheus, Grafana, Kubernetes trong kiến trúc này

Mỗi công cụ quen thuộc của DevOps đều có vai trò tương đương trong AWS, đã có sẵn và miễn phí ở mức demo:

| Vai trò          | Stack "kinh điển" | Ở đây dùng                                        | Vì sao                                                                                                                                                                                                                             |
| ---------------- | ----------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Thu thập metrics | Prometheus        | CloudWatch Metrics + Embedded Metric Format (EMF) | Prometheus **kéo (scrape)** số liệu từ một endpoint chạy lâu dài. Lambda chỉ sống vài trăm ms rồi biến mất, không có gì để scrape. Muốn dùng Prometheus phải dựng server hoặc push gateway chạy 24/7 → tốn tiền, đi ngược mục tiêu |
| Dashboard        | Grafana           | CloudWatch Dashboard (≤ 3 dashboard miễn phí)     | Đủ cho demo                                                                                                                                                                                                                        |
| Logs             | Loki / ELK        | CloudWatch Logs + Logs Insights                   | Lambda tự đẩy log vào đây                                                                                                                                                                                                          |
| Traces           | Jaeger / Tempo    | AWS X-Ray                                         | Lambda và API Gateway tích hợp sẵn, chỉ cần bật                                                                                                                                                                                    |
| Alerting         | Alertmanager      | CloudWatch Alarm → SNS → email                    | ≤ 10 alarm miễn phí                                                                                                                                                                                                                |
| Orchestration    | Kubernetes        | Không cần                                         | Xem dưới                                                                                                                                                                                                                           |

### Vì sao không có Kubernetes

Kubernetes giải bài toán _điều phối container chạy lâu dài_: đặt container lên node, restart khi chết, scale số replica. Lambda đã làm hết việc đó thay mình — không có container nào để điều phối. Thêm vào đó, control plane EKS tốn khoảng $73/tháng dù không chạy gì. Đưa K8s vào dự án này chỉ để có từ khoá trên CV là quyết định khó bảo vệ khi bị hỏi "vì sao".

Nếu muốn học K8s cho CV, nên làm ở một dự án riêng chạy local (kind/k3d), không trộn vào đây.

### Tuỳ chọn: Grafana Cloud (free)

Nếu muốn có từ khoá Grafana: Grafana Cloud có gói miễn phí, thêm CloudWatch làm data source bằng một IAM role chỉ đọc. Không dựng server, không tốn tiền AWS ngoài vài lệnh `GetMetricData` (nằm trong free tier ở mức thỉnh thoảng xem). Đánh dấu là **tuỳ chọn**, làm sau khi CloudWatch Dashboard đã chạy.

Không dùng Amazon Managed Grafana — tính tiền theo user mỗi tháng.

## Thay đổi

### Log có cấu trúc + correlation ID (đóng OD-07)

- Dùng `@aws-lambda-powertools/logger` cho cả Lambda `api` và 8 worker: log JSON, tự gắn `requestId`, cold start, tên function.
- API: middleware lấy `x-correlation-id` từ header (hoặc sinh mới), trả lại trong response, đính vào mọi log.
- Truyền correlation ID qua **message attribute** của SQS và **input** của Step Functions để một lần import có thể lần theo từ API tới writer.

### Traces (đóng OD-05)

- `tracing_config { mode = "Active" }` cho mọi Lambda, bật tracing trên Step Functions.
- `@aws-lambda-powertools/tracer` bọc AWS SDK client để thấy được segment S3/SQS/SFN.
- Bỏ đường OTLP → `localhost:4318` khi chạy trên Lambda (đã nói ở P2). Giữ `tracing.ts` cho chạy local nếu muốn.

### Custom metrics nghiệp vụ

Ghi bằng EMF (in log JSON đúng format, CloudWatch tự trích metric — không gọi `PutMetricData`). Giữ **dưới 10 metric** để nằm trong free tier:

`ImportRowsCommitted`, `ImportJobFailed`, `ImportDurationMs`, `ReportGenerated`, `TransferApproved`, `ReconciliationMismatch`.

### Dashboard `stockflow-overview`

Một dashboard, bốn hàng:

1. **Traffic:** request API Gateway, 4xx, 5xx, p50/p95 latency.
2. **Compute:** invocation, error, throttle, duration p95, cold start theo từng Lambda.
3. **Pipeline:** số execution Step Functions theo trạng thái; độ sâu 3 DLQ.
4. **Nghiệp vụ:** các metric EMF ở trên.

### Alarm (tổng ≤ 10, đóng OD-06)

Đã có 4 alarm SQS/DLQ từ E3. Thêm:

| Alarm                           | Ngưỡng                                                     |
| ------------------------------- | ---------------------------------------------------------- |
| API 5xx                         | > 5 trong 5 phút                                           |
| API p95 latency                 | > 3s trong 15 phút (cao vì cold start)                     |
| Lambda `api` throttles          | > 0 — nghĩa là reserved concurrency đang chặn traffic thật |
| Step Functions failed           | ≥ 1                                                        |
| Lambda errors (tổng các worker) | > 3 trong 15 phút                                          |

Tất cả gửi về SNS topic `stockflow-ops-alerts` → email.

## Trạng thái — 2026-10-13

Code và Terraform đã xong, đã push (`9ea70a7`, `d597b6f`, `394b913`). **Chưa kiểm chứng trên AWS** nên các ô ở mục Kiểm chứng chưa tick và OD-05/06/07 chưa đóng.

Khác với plan ở trên:

- **Correlation ID qua Step Functions:** không thêm `correlationId` vào input. Luồng import bắt đầu từ sự kiện S3 nên không có ID do client gửi; `importJobId` đã đi xuyên các state và được dùng làm correlation ID (`extractCorrelationId` trong `packages/shared/src/correlation.ts`). Report đi qua message attribute `correlationId` của SQS.
- **Đường import của helper:** helper logging/trace/metrics import qua `@stockflow/shared/dist/<module>`, không qua `index`, vì `apps/web` import `@stockflow/shared` mà Next không bundle được `async_hooks`/`fs`.
- **Alarm "Lambda api throttles":** đặt trên Lambda `api` với ý nghĩa "tài khoản chạm trần concurrency", vì không có reserved concurrency (hạn mức tài khoản 10). HTTP API không có metric throttle riêng.
- **Endpoint debug 5xx:** ban đầu không làm, sau đó bổ sung ở `5ad81b7` (`/api/debug/fail`, chỉ bật qua biến môi trường). Vẫn có thể thử đường alarm → SNS → email bằng `aws cloudwatch set-alarm-state` (xem `docs/runbooks/observability.md`).
- **Tổng:** 9 alarm, 1 dashboard `stockflow-overview`, 6 custom metric (EMF), SNS topic `stockflow-ops-alerts`.

Việc còn lại để đóng P4 (cập nhật 2026-10-15: API và worker đã đọc được DB, xem SUMMARY):

1. Đặt GitHub secret `OPS_REPORT_EMAIL`, duyệt deploy ở Environment `production`, rồi bấm Confirm trong email subscription của AWS.
2. Chạy các mục Kiểm chứng bên dưới, chụp ảnh làm bằng chứng.
3. Đo lại cold start của `/api/health` (trước P4: ~3,0 giây, request sau ~0,26 giây) để biết Tracer có làm chậm không.
4. Xác nhận alarm `stockflow-api-5xx` và `stockflow-api-latency-p95` có dữ liệu (không kẹt ở `INSUFFICIENT_DATA`). Nếu kẹt, thử thêm dimension `Stage = "$default"`.
5. Tick plan, đóng OD-05/06/07 trong `docs/debt/operational-debt.md`, viết `EXECUTION-REPORT.md`.

## Kiểm chứng

- [ ] Logs Insights query theo một `correlationId` ra đủ log từ API → parser → writer của một lần import.
- [ ] X-Ray service map hiển thị API Gateway → Lambda api → SQS → report-exporter → S3.
- [ ] Ép lỗi 5xx bằng một endpoint debug (chỉ bật qua biến môi trường) → alarm chuyển ALARM → nhận email.
  - 2026-10-15: endpoint đã có, pipeline đọc biến repo `ENABLE_DEBUG_ENDPOINT`; đang chờ deploy #24 để bật và gọi thử (xem Bàn giao trong SUMMARY).
- [ ] Số alarm ≤ 10, số dashboard ≤ 3.
