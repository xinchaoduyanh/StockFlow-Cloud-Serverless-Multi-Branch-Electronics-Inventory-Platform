# StockFlow Cloud — Serverless Multi-Branch Electronics Inventory Platform

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/Backend-NestJS%2010-red?style=flat-square&logo=nestjs)](https://nestjs.com/)
[![AWS Lambda](https://img.shields.io/badge/AWS-Lambda-orange?style=flat-square&logo=amazon-aws)](https://aws.amazon.com/lambda/)
[![AWS Step Functions](https://img.shields.io/badge/AWS-Step%20Functions-pink?style=flat-square&logo=amazon-aws)](https://aws.amazon.com/step-functions/)
[![PostgreSQL](https://img.shields.io/badge/Database-Neon%20Postgres-blue?style=flat-square&logo=postgresql)](https://neon.tech/)
[![Pusher](https://img.shields.io/badge/Realtime-Pusher%20Channels-purple?style=flat-square&logo=pusher)](https://pusher.com/)
[![AWS Cognito](https://img.shields.io/badge/Auth-AWS%20Cognito-red?style=flat-square&logo=amazon-aws)](https://aws.amazon.com/cognito/)

**StockFlow Cloud** là hệ thống quản lý kho linh kiện điện tử chuyên nghiệp cho chuỗi cửa hàng nhiều chi nhánh. Dự án chạy hoàn toàn serverless trên AWS: NestJS API chạy trong Lambda sau API Gateway, các Lambda worker điều phối bởi Step Functions và SQS xử lý tác vụ bất đồng bộ nặng, database là Neon Postgres. Không có VPC, NAT, ALB hay container chạy thường trực nên lúc không có traffic chi phí về xấp xỉ 0 (xem [ADR-001](docs/adr/ADR-001-full-serverless-zero-idle-cost.md)).

> [!NOTE]
> **Cold start:** request đầu tiên sau một thời gian không dùng có thể mất vài giây vì Lambda khởi động NestJS và Neon tự ngủ. Số đo thật sẽ được ghi vào [bằng chứng P6](docs/evidence/261002-first-apply/README.md) sau khi đo.

---

## 🚀 Tính năng & Khả năng của Hệ thống (Capabilities)

### 1. Quản lý Tồn kho Đa chi nhánh Thời gian thực

- **Theo dõi trạng thái tồn kho**: Tự động phân tách số lượng tồn kho thành 3 trạng thái:
  - `quantity` (Tổng tồn kho vật lý)
  - `reserved_quantity` (Tồn kho bị tạm giữ để chờ chuyển hàng)
  - `available_quantity` (Tồn kho thực tế có sẵn sàng kinh doanh/chuyển kho = `quantity` - `reserved_quantity`).
- **Cảnh báo tồn kho thấp (Low Stock Alert)**: Hệ thống tự động quét và đưa ra cảnh báo thời gian thực khi hàng hóa xuống dưới ngưỡng an toàn thiết lập cho từng chi nhánh.

### 2. Pipeline Import Excel Bất đồng bộ Hiệu năng cao

- **Hỗ trợ tải lên trực tiếp**: Upload file Excel dung lượng lớn trực tiếp từ trình duyệt lên AWS S3 thông qua Presigned URL bảo mật.
- **Xử lý luồng Event-Driven**: S3 Event Notification kích hoạt AWS Step Functions để điều phối quá trình xử lý bất đồng bộ mà không gây tải cho API chính.
- **Xử lý luồng lớn an toàn**: Stream-parse file Excel dung lượng lớn bằng thư viện chuyên dụng, ghi nhận trạng thái kiểm tra (Validate) chi tiết tới từng dòng dữ liệu trước khi lưu vào DB staging.
- **Cơ chế Duyệt trước (Import Preview)**: Người dùng có thể kiểm tra danh sách dòng hợp lệ, dòng lỗi và tác động tồn kho dự kiến trước khi xác nhận lưu vào kho thật.
- **Đảm bảo Idempotency (Tránh trùng lặp)**: Hash key duy nhất trên mỗi dòng Excel đảm bảo không bị cộng dồn kho hai lần khi có sự cố retry.

### 3. Luồng Chuyển kho Nguyên tố & An toàn (Secure Transfer Workflow)

- **Luồng phê duyệt chặt chẽ**: Quản lý chi nhánh tạo yêu cầu chuyển kho -> Hệ thống lập tức trừ `available_quantity` và tăng `reserved_quantity` để giữ hàng -> Admin hoặc Thủ kho duyệt hoặc từ chối yêu cầu.
- **Giao dịch Cơ sở dữ liệu Nguyên tố (Database Transactions)**: Khi phê duyệt chuyển kho, hệ thống thực hiện transaction đảm bảo tính nhất quán (trừ chi nhánh gửi, cộng chi nhánh nhận, ghi ledger). Mọi lỗi phát sinh đều thực hiện Rollback hoàn toàn.
- **Nhật ký Vận động Kho (Stock Movement Ledger)**: Ghi lại lịch sử chi tiết mọi thay đổi số lượng kho (`IMPORT_IN`, `TRANSFER_OUT`, `TRANSFER_IN`, `RESERVATION_CREATED`...) làm cơ sở đối soát.

### 4. Đối soát Kho tự động Hằng ngày (Daily Auto-Reconciliation)

- **Phát hiện sai lệch**: Một Lambda Cron Job được lập lịch chạy hằng đêm, quét và so khớp dữ liệu tồn kho hiện thời (`inventory.quantity`) với tổng lịch sử biến động trong Ledger (`stock_movements`).
- **Quản lý sự cố đối soát**: Khi phát hiện chênh lệch, hệ thống tự động sinh `Reconciliation Issue` cảnh báo và lưu lại báo cáo đối soát để Admin kiểm tra và xử lý.

### 5. Quản trị lỗi import với bảng điều khiển recovery

- **Giám sát lỗi đầu-cuối**: EventBridge chuyển trạng thái terminal của Step Functions vào SQS recovery queue; worker lưu recovery item bền vững trong PostgreSQL.
- **Replay/Discard có kiểm soát**: Admin thao tác qua bảng điều khiển recovery với lý do bắt buộc, giới hạn số lần replay và audit log. Replay giữ nguyên các row đã commit để tránh cộng tồn kho hai lần.

### 6. Xuất Báo cáo Bất đồng bộ (Async Report Generation)

- **Tải báo cáo dung lượng lớn**: Hỗ trợ xuất dữ liệu báo cáo tồn kho, lịch sử chuyển kho, xuất báo cáo tồn thấp ra Excel/CSV.
- **Xử lý qua queue**: API tạo `ExportJob` rồi gửi message có version vào SQS; Report Lambda consumer claim job có điều kiện, lưu artifact với key xác định và trả partial batch failures. Message hết retry được chuyển sang DLQ thật để Admin replay, discard hoặc redrive.

### 7. Tích hợp Real-time Notifications & Enterprise Authentication

- **Thông báo tức thời**: Tích hợp Pusher Channels đẩy thông báo WebSocket real-time tới giao diện người dùng ngay khi có yêu cầu chuyển kho mới, cảnh báo tồn thấp, hoặc hoàn thành import.
- **Bảo mật chuẩn Enterprise**: Sử dụng AWS Cognito User Pool quản lý tài khoản bảo mật cao, kết hợp phân quyền Role-based Access Control (RBAC) chặt chẽ giữa 3 vai trò: `ADMIN`, `STORE_MANAGER`, và `WAREHOUSE`.

---

## 🗺️ Kiến trúc Hệ thống (System Architecture)

### 1. Kiến trúc Tổng thể (High-Level Architecture)

Sơ đồ kiến trúc hiện hành nằm ở mục [Hướng dẫn Triển khai](#️-hướng-dẫn-triển-khai-hệ-thống-deployment-guide). Hình SVG cũ (ECS/ALB) đã bị gỡ vì không còn đúng.

---

### 2. Luồng xử lý File của Step Functions (State Machine Ingestion Flow)

Đây là **điểm sáng kỹ thuật cốt lõi** của dự án. Hệ thống sử dụng mô hình **Human-in-the-Loop** thông qua tính năng `waitForTaskToken` của Step Functions. Luồng xử lý cụ thể như sau:

![Step Functions State Machine Flow](docs/Serverless%20Ingestion-2026-06-04-074926.svg)

#### Chi tiết Luồng Phê duyệt (Confirm/Cancel Workflow):

1. Khi file được tải lên S3, EventBridge kích hoạt State Machine.
2. **Validator Lambda** kiểm tra định dạng MIME, kiểm tra tiêu đề các cột (headers) có đúng chuẩn template.
3. **Parser Lambda** đọc dữ liệu Excel dạng stream (tiết kiệm bộ nhớ), validate dữ liệu từng dòng rồi ghi vào bảng tạm `import_job_rows` với idempotency key ổn định theo `importJobId:rowNumber`.
4. **HaltForUserApproval**: State Machine gọi Lambda `ImportApprovalTokenRegisterFunction` để lưu `taskToken` (mã giao dịch Step Functions) vào Database ứng với `importJobId` rồi **tạm dừng (Pause)**.
5. Người dùng xem bảng Preview hiển thị trên frontend. Nếu dữ liệu ổn, người dùng bấm nút **Xác nhận nhập kho (Confirm)**.
6. API Backend nhận yêu cầu Confirm, đọc `taskToken` trong DB ra và gửi tín hiệu `SendTaskSuccess` lên Step Functions.
7. State Machine tự động **tiếp tục (Resume)** chạy bước **CommitInventory (Writer Lambda)** thực hiện ghi dữ liệu chính thức vào bảng Tồn kho thật theo từng lô (Batch 500 dòng) nằm trong một DB Transaction an toàn.

---

## 🛠️ Hướng dẫn Triển khai Hệ thống (Deployment Guide)

Monorepo (Turborepo) gồm NestJS API (Lambda), Lambda worker, Web client (Next.js static export lên S3 + CloudFront). Terraform trong `infrastructure/terraform` là chủ sở hữu duy nhất của mọi resource AWS.

```text
Browser ─► CloudFront + S3 (frontend tĩnh)
        └► API Gateway HTTP API ─► Lambda "api" (NestJS)
                                      ├► Neon Postgres (pooled endpoint)
                                      ├► SQS report-jobs ─► Lambda report-exporter ─► S3
                                      ├► S3 imports ─► Step Functions ─► Lambda worker
                                      └► Pusher, Cognito, SES

EventBridge Scheduler (07:00) ─► Lambda daily-ops-report ─► SES ─► email vận hành
GitHub Actions: quality ─► deploy (OIDC, không có access key) ─► smoke test
```

### 1. Triển khai tự động

Push lên `main`: job `quality` và `terraform` xanh thì job `deploy` build Lambda, migrate Neon, chạy `terraform plan` (có chốt chặn resource stateful), `apply`, sync frontend và smoke test `/api/health` kiểm commit SHA. Chi tiết và danh sách secret: [deploy runbook](docs/runbooks/deploy.md).

### 2. Dựng lại từ con số 0

Làm theo [rebuild-from-zero](docs/runbooks/rebuild-from-zero.md) (bootstrap state bucket, OIDC, apply lần đầu, seed, trỏ DNS). Máy dev mới: [new-machine-setup](docs/runbooks/new-machine-setup.md).

### 3. Chạy local

```bash
npm install
npm run build:lambdas   # đóng gói Lambda worker bằng esbuild
npm run verify          # format, lint, typecheck, build, test, build:lambdas
```

API local dùng Postgres trong Docker qua `apps/api/.env`; Neon chỉ dành cho bản deploy.

### 4. Vận hành

- Quan sát (dashboard, alarm, X-Ray, Logs Insights): [observability runbook](docs/runbooks/observability.md).
- Sự cố import và report (DLQ, redrive, replay): [E3 recovery runbook](docs/runbooks/e3-recovery.md).

---

## ⚡ Tối ưu Hệ thống

### 1. Đảm bảo Idempotency (Tránh ghi đè kho trùng lặp)

Khi Step Functions hoặc Lambda retry Writer sau lỗi tạm thời, cùng một dòng có thể được giao lại. Để tránh việc hàng hóa bị cộng dồn hai lần, hệ thống sử dụng một idempotency key ổn định theo import job và số dòng:

```text
idempotency_key = import_job_id + ":" + row_number
```

`import_job_rows.idempotency_key` có unique constraint. Parser dùng `skipDuplicates`, còn Writer claim row bằng
`UPDATE ... WHERE validation_status = 'VALID'` trước khi cộng kho; vì vậy retry hoặc event trùng không cộng
inventory hai lần.

### 2. Ngăn ngừa oversell bằng Conditional Reservation

Khi hai yêu cầu tạo chuyển kho cùng lúc, hệ thống dùng một conditional update atomic trên PostgreSQL:

```sql
UPDATE inventory
SET reserved_quantity = reserved_quantity + $requested_qty,
    version = version + 1
WHERE branch_id = $branch_id
  AND component_id = $component_id
  AND quantity - reserved_quantity >= $requested_qty;
```

PostgreSQL khóa row trong lúc update; request thứ hai nhận `affected rows = 0` khi phần tồn khả dụng không còn đủ và transaction được rollback.

### 3. Tối ưu hóa Kết nối PostgreSQL trong môi trường Serverless

Lambda scale-out theo số request đồng thời dễ làm cạn connection của PostgreSQL. Hệ thống xử lý bằng cách:

- **Database là Neon Postgres** (free tier, Singapore). Lambda dùng _pooled endpoint_ (PgBouncer của Neon), còn `prisma migrate deploy` dùng _direct endpoint_ qua `directUrl`.
- Prisma Client trong mỗi Lambda dùng `connection_limit=1`, nên mỗi container giữ tối đa một kết nối.
- URL database nằm trong SSM Parameter Store (`/stockflow/database-url`); Lambda đọc lúc khởi động rồi mới tạo `PrismaClient`.
- Chặn "denial of wallet": API Gateway throttling (20 rps, burst 40) cộng budget alert $1 / $5.
