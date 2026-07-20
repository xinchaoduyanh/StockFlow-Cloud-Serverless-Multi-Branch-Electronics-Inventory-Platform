# StockFlow Cloud — Serverless Multi-Branch Electronics Inventory Platform

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/Backend-NestJS%2010-red?style=flat-square&logo=nestjs)](https://nestjs.com/)
[![AWS Lambda](https://img.shields.io/badge/AWS-Lambda-orange?style=flat-square&logo=amazon-aws)](https://aws.amazon.com/lambda/)
[![AWS Step Functions](https://img.shields.io/badge/AWS-Step%20Functions-pink?style=flat-square&logo=amazon-aws)](https://aws.amazon.com/step-functions/)
[![PostgreSQL](https://img.shields.io/badge/Database-Neon%20Postgres-blue?style=flat-square&logo=postgresql)](https://neon.tech/)
[![Pusher](https://img.shields.io/badge/Realtime-Pusher%20Channels-purple?style=flat-square&logo=pusher)](https://pusher.com/)
[![AWS Cognito](https://img.shields.io/badge/Auth-AWS%20Cognito-red?style=flat-square&logo=amazon-aws)](https://aws.amazon.com/cognito/)

**StockFlow Cloud** là hệ thống quản lý kho linh kiện điện tử chuyên nghiệp cho chuỗi cửa hàng nhiều chi nhánh. Dự án được thiết kế theo kiến trúc Serverless lai (Hybrid Serverless Architecture) trên nền tảng AWS, kết hợp giữa NestJS API chạy trên hạ tầng containerized và hệ thống Lambda Workers điều phối bởi Step Functions để xử lý các tác vụ bất đồng bộ nặng (Heavy Asynchronous Ingestion Job).

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

![High-Level Architecture](docs/Serverless%20Ingestion-2026-06-04-074910.svg)

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

Hệ thống được tổ chức theo cấu trúc Monorepo (quản lý bởi Turborepo) chia làm 3 mảng triển khai chính: NestJS API (đóng gói Container), Web Client (Next.js Static Export), và Serverless Workers do Terraform quản lý.

### 1. Chuẩn bị & Biên dịch Lambdas

Tất cả mã nguồn Lambdas viết bằng TypeScript cần được biên dịch và đóng gói thành file Javascript tối giản (minified) sử dụng `esbuild` nhằm tối ưu thời gian khởi động lạnh (cold-start < 100ms):

```bash
# Cài đặt dependencies tại thư mục gốc
npm install

# Build & đóng gói toàn bộ Lambdas vào thư mục /dist/lambdas
npm run build:lambdas
```

---

### 2. Triển khai API Backend (NestJS) lên AWS ECS Fargate & ALB

Ứng dụng NestJS chính (`apps/api`) được deploy dạng container để chạy 24/7 ổn định.

#### Bước A: Đóng gói và Đẩy Docker Image lên ECR

1. Khởi tạo một Repository trên AWS ECR: `stockflow-api`.
2. Build Docker image từ Dockerfile trong thư mục `apps/api`:
   ```bash
   docker build -t stockflow-api ./apps/api
   ```
3. Login vào AWS ECR và đẩy image lên:
   ```bash
   aws ecr get-login-password --region <REGION> | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com
   docker tag stockflow-api:latest <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/stockflow-api:latest
   docker push <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/stockflow-api:latest
   ```

#### Bước B: Cấu hình ECS Fargate & ALB

1. **Khởi tạo VPC**: Sử dụng Public subnets cho Load Balancer và Private subnets cho ECS Tasks nhằm tối ưu bảo mật.
2. **Cấu hình ACM (AWS Certificate Manager)**: Đăng ký chứng chỉ SSL/TLS miễn phí cho domain của bạn (ví dụ: `api.yourdomain.com`).
3. **Cấu hình Application Load Balancer (ALB)**:
   - Tạo ALB đặt ở các Public subnets của VPC.
   - Tạo **Target Group** cấu hình kiểu Target Type là `IP` (bắt buộc cho Fargate), cổng `80` hoặc `3000` tùy cấu hình Docker, thiết lập Health Check endpoint chỉ tới `/health` hoặc `/api/health`.
   - Cấu hình Listener HTTPS (cổng 443) trên ALB, gắn chứng chỉ ACM SSL đã tạo ở trên và chuyển tiếp traffic tới Target Group.
4. **Cấu hình ECS Task & Service**:
   - Khởi tạo ECS Cluster.
   - Tạo ECS Task Definition kiểu khởi chạy Fargate. Khai báo Image URI từ ECR ở bước A, định nghĩa các biến môi trường cấu hình kết nối database, Pusher, Cognito User Pool, S3 Bucket...
   - Tạo ECS Service chạy Task Definition trên ở các Private subnets.
   - **Security Group (SG) Rules**:
     - SG của ECS Service chỉ cho phép kết nối Ingress từ SG của ALB (ngăn chặn truy cập trực tiếp từ Internet bypass load balancer).
     - SG của ALB cho phép Ingress cổng 80 (để redirect sang 443) và cổng 443 từ mọi nơi (`0.0.0.0/0`).

---

### 3. Triển khai hạ tầng serverless

Terraform là owner production duy nhất cho Lambda, SQS, Step Functions, EventBridge và SNS. Build handler rồi kiểm tra plan trước khi apply:

```bash
npm run build:lambdas
terraform -chdir=infrastructure/terraform init
terraform -chdir=infrastructure/terraform validate
terraform -chdir=infrastructure/terraform plan
```

Không dùng SAM để deploy song song; các bước smoke test và rollback nằm trong [E3 recovery runbook](docs/runbooks/e3-recovery.md).

---

### 4. Triển khai Frontend Web (Next.js) lên S3 & CloudFront

Frontend Next.js (`apps/web`) được build ở dạng static export để host trực tiếp trên CDN giá rẻ và tốc độ siêu nhanh.

1. Cấu hình các biến môi trường trong `.env.production` ở thư mục `apps/web` chỉ tới URL của ALB API (`api.yourdomain.com`) và cấu hình Cognito Client ID.
2. Build và xuất bản static files:
   ```bash
   # Chạy lệnh tại thư mục gốc monorepo
   npm run build:web
   ```
   Lệnh này sinh ra các file tĩnh tại thư mục `apps/web/out`.
3. Khởi tạo một S3 Bucket với chính sách truy cập Private (không public ra ngoài).
4. Đồng bộ các files tĩnh lên S3:
   ```bash
   aws s3 sync apps/web/out s3://your-nextjs-s3-bucket-name/
   ```
5. **Cấu hình AWS CloudFront**:
   - Khởi tạo một CloudFront Distribution, chọn Origin Domain chỉ tới S3 Bucket chứa Next.js assets ở trên.
   - **Bảo mật truy cập S3**: Sử dụng **OAC (Origin Access Control)** hoặc **OAI (Origin Access Identity)** để cấp quyền cho CloudFront đọc file từ S3, và cập nhật Bucket Policy trên S3 chỉ cho phép đọc từ CloudFront.
   - Gắn chứng chỉ ACM SSL cho tên miền frontend (ví dụ: `app.yourdomain.com`).
   - Thiết lập **Error Pages**: Định cấu hình lỗi `404` trả về file `/index.html` với mã HTTP `200` để hỗ trợ cơ chế Client-side Routing của ứng dụng Single Page (Next.js Static Export).

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

Mô hình Lambda tự động scale-out theo lượng requests đồng thời rất dễ làm cạn kiệt connection pool của cơ sở dữ liệu truyền thống. Hệ thống đã tối ưu bằng cách:

- Sử dụng Neon Serverless Postgres tích hợp sẵn **PgBouncer** ở chế độ Transaction Mode.
- Cấu hình Prisma Client trong mỗi function Lambda khởi tạo kết nối với tùy chọn `connection_limit=1`. Điều này đảm bảo mỗi container Lambda chỉ giữ tối đa 1 kết nối duy nhất đến database trong suốt vòng đời của nó.
