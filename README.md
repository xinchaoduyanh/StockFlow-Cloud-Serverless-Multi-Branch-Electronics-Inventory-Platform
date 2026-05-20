# Electronics Inventory Management System (EIMS)

## 1. Project Overview

**EIMS — Electronics Inventory Management System** là hệ thống quản lý kho linh kiện điện tử cho chuỗi cửa hàng nhiều chi nhánh.

Hệ thống hỗ trợ Store Manager nhập kho bằng file Excel, quản lý tồn kho theo chi nhánh, tạo yêu cầu chuyển hàng giữa các chi nhánh, và cho phép Admin/Warehouse phê duyệt transfer, theo dõi tồn kho thấp, export báo cáo và giám sát hệ thống bằng AWS CloudWatch.

Mục tiêu của dự án là xây dựng một hệ thống backend/cloud thực tế, có thể dùng làm portfolio cho vị trí:

- Backend Developer with AWS
- Junior/Middle AWS Developer
- Middle Backend Engineer có kinh nghiệm serverless
- Cloud-aware Backend Developer

---

## 2. Main Goals

Dự án tập trung vào 4 mục tiêu chính:

1. **Import Excel bất đồng bộ**
   - Upload file Excel lên S3 bằng presigned URL.
   - Xử lý file bằng Lambda/SQS/Step Functions.
   - Validate từng dòng.
   - Có import preview trước khi commit tồn kho.
   - Có progress tracking.
   - Có row-level errors.
   - Có idempotency để tránh cộng kho trùng khi retry.

2. **Inventory Management**
   - Quản lý linh kiện theo chi nhánh.
   - Tìm kiếm theo SKU/tên.
   - Filter theo category/brand/branch.
   - Theo dõi tồn kho hiện tại, reserved quantity, available quantity.
   - Cảnh báo low stock.

3. **Transfer Workflow**
   - Store Manager tạo yêu cầu chuyển hàng.
   - Hệ thống reserve stock khi tạo transfer.
   - Admin/Warehouse approve hoặc reject.
   - Khi approve, hệ thống cập nhật tồn kho bằng transaction.
   - Ghi stock movement ledger và audit log.

4. **Production-readiness**
   - CloudWatch metrics, alarms, dashboard.
   - DLQ và DLQ replay.
   - Daily reconciliation job.
   - CI/CD.
   - Infrastructure as Code.
   - ADR documents.
   - Performance benchmark.

---

## 3. Actors

### 3.1 Store Manager

Quản lý một chi nhánh cụ thể.

Có thể:

- Upload Excel nhập kho cho chi nhánh của mình.
- Xem import progress.
- Xem lỗi import từng dòng.
- Confirm import sau khi preview.
- Xem tồn kho chi nhánh mình.
- Search/filter linh kiện.
- Tạo yêu cầu chuyển hàng sang chi nhánh khác.
- Xem lịch sử transfer liên quan đến chi nhánh mình.
- Xem low stock của chi nhánh mình.

### 3.2 Admin

Quản lý toàn bộ hệ thống.

Có thể:

- Xem inventory toàn chuỗi.
- Xem tất cả branch.
- Approve/reject transfer.
- Xem báo cáo low stock toàn hệ thống.
- Export report.
- Xem audit logs.
- Xem import history.
- Quản lý user/role nếu có.
- Xem CloudWatch dashboard.

### 3.3 Warehouse

Có thể xem như role vận hành kho.

Có thể:

- Xem tồn kho toàn chuỗi hoặc theo quyền được cấp.
- Approve/reject transfer.
- Theo dõi stock movement.
- Xem low stock.
- Xử lý failed import/replay DLQ nếu được cấp quyền.

---

## 4. Suggested Tech Stack

### Frontend

- React
- TypeScript
- Tailwind CSS
- React Query
- Zustand hoặc Redux Toolkit
- Vite

### Backend

Có thể chọn một trong hai hướng:

#### Option A — Express/NestJS chạy trên Lambda

- Node.js
- TypeScript
- Express hoặc NestJS
- Serverless Framework / AWS SAM / CDK

#### Option B — Modular Monolith Backend

- Node.js
- TypeScript
- NestJS
- Module-based architecture
- Deploy lên Lambda hoặc container sau này

### Database

Khuyến nghị dùng:

- PostgreSQL cho core inventory, transfer, reporting
- Prisma hoặc TypeORM làm ORM

Lý do chọn PostgreSQL:

- Cần transaction mạnh cho transfer.
- Cần relational query giữa branch, component, inventory, transfer.
- Dễ làm report.
- Dễ dùng optimistic locking.
- Phù hợp với business logic inventory.

### AWS Services

- S3 — lưu file Excel import và report export
- API Gateway — public API
- Lambda — xử lý API và async jobs
- SQS — queue import/report/retry
- DLQ — lưu failed messages
- Step Functions — orchestration import pipeline
- CloudWatch Logs — log hệ thống
- CloudWatch Metrics — custom metrics
- CloudWatch Alarms — cảnh báo lỗi
- EventBridge — event-driven communication, optional
- Secrets Manager — lưu DB credentials
- Cognito — authentication, optional
- SNS/SES — notification, optional
- RDS PostgreSQL — database chính

---

## 5. High-Level Architecture

```text
React Frontend
    |
    | HTTPS
    v
API Gateway
    |
    v
Lambda API Layer
    |
    +----------------------+
    |                      |
    v                      v
PostgreSQL              S3 Bucket
Core DB                 Excel files / Reports
    |
    v
Business Modules
    |
    +--> Inventory Module
    +--> Import Module
    +--> Transfer Module
    +--> Report Module
    +--> Audit Module
    +--> Notification Module
```

Async import flow:

```text
Frontend
  |
  | POST /imports/init
  v
API Gateway + Lambda
  |
  | create import_job
  | generate presigned URL
  v
S3 Presigned Upload
  |
  | upload Excel file
  v
S3
  |
  | publish import requested event
  v
SQS / Step Functions
  |
  v
Parser Lambda
  |
  v
Validator Lambda
  |
  v
Preview Result
  |
  | user confirms import
  v
Writer Lambda
  |
  v
PostgreSQL inventory update
  |
  v
CloudWatch metrics + audit log
```

---

## 6. Core Modules

### 6.1 Auth Module

Mục tiêu:

- Login.
- Xác định user hiện tại.
- Phân quyền theo role.
- Branch-level access control.

Roles:

```text
STORE_MANAGER
WAREHOUSE
ADMIN
```

Permission examples:

```text
inventory:read
inventory:update
import:create
import:confirm
transfer:create
transfer:approve
report:export
audit:read
admin:manage-users
```

---

### 6.2 Branch Module

Quản lý chi nhánh.

Branch fields:

```text
id
code
name
address
status
created_at
updated_at
```

API:

```text
GET /branches
GET /branches/:id
POST /branches
PATCH /branches/:id
```

MVP có thể seed branch bằng script thay vì làm UI quản lý branch.

---

### 6.3 Component Module

Quản lý thông tin linh kiện.

Component fields:

```text
id
sku
name
brand
category
specs
unit_price
supplier
warranty_months
created_at
updated_at
```

Category examples:

```text
RAM
CPU
SSD
GPU
MAINBOARD
PSU
CASE
COOLER
```

`specs` là JSONB để lưu thông số khác nhau theo từng category.

Ví dụ RAM:

```json
{
  "ddr_generation": "DDR4",
  "speed_mhz": 3200,
  "capacity_gb": 8
}
```

Ví dụ CPU:

```json
{
  "socket": "LGA1700",
  "cores": 6,
  "threads": 12
}
```

Ví dụ SSD:

```json
{
  "interface": "NVMe",
  "capacity_gb": 1000,
  "form_factor": "M.2 2280"
}
```

---

### 6.4 Inventory Module

Quản lý tồn kho hiện tại.

Inventory cần có:

```text
branch_id
component_id
quantity
reserved_quantity
available_quantity
min_stock_threshold
version
updated_at
```

Trong đó:

```text
available_quantity = quantity - reserved_quantity
```

Ý nghĩa:

- `quantity`: tổng số lượng vật lý đang có.
- `reserved_quantity`: số lượng đã được giữ cho transfer pending.
- `available_quantity`: số có thể dùng để transfer.
- `version`: dùng cho optimistic locking.

API:

```text
GET /inventory
GET /inventory/:sku
GET /branches/:branchId/inventory
PATCH /inventory/:id
GET /reports/low-stock
```

Query examples:

```text
GET /inventory?branch_id=BR001&category=RAM&search=kingston&page=1&limit=20
GET /inventory?low_stock=true
```

---

### 6.5 Import Module

Đây là module quan trọng nhất.

Mục tiêu:

- Upload Excel.
- Parse file.
- Validate row-level.
- Tạo preview trước khi commit.
- Confirm import.
- Commit inventory update.
- Track progress.
- Save errors.
- Retry an toàn.
- Không cộng kho trùng khi retry.

Import statuses:

```text
UPLOADED
PARSING
VALIDATING
PREVIEW_READY
CONFIRMING
COMMITTING
COMPLETED
PARTIAL_FAILED
FAILED
CANCELLED
```

Import flow:

```text
1. User calls POST /imports/init
2. System creates import_job
3. System returns presigned URL
4. User uploads Excel to S3
5. System starts async parsing
6. System validates rows
7. System saves preview result
8. User reviews preview
9. User confirms import
10. System commits valid rows
11. System updates inventory
12. System records stock movements
13. System marks job completed or partial failed
```

API:

```text
POST /imports/init
POST /imports/:id/start
GET /imports
GET /imports/:id
GET /imports/:id/progress
GET /imports/:id/errors
GET /imports/:id/preview
POST /imports/:id/confirm
POST /imports/:id/cancel
POST /imports/:id/retry-failed-rows
```

---

### 6.6 Transfer Module

Mục tiêu:

- Tạo yêu cầu chuyển hàng giữa chi nhánh.
- Reserve stock khi tạo request.
- Admin/Warehouse approve/reject.
- Cập nhật inventory bằng transaction.
- Ghi stock movement.
- Ghi audit log.

Transfer statuses:

```text
PENDING
APPROVED
REJECTED
COMPLETED
FAILED
CANCELLED
```

Transfer flow:

```text
1. Store Manager creates transfer request.
2. System checks available quantity.
3. System increases reserved_quantity.
4. Transfer status = PENDING.
5. Admin/Warehouse reviews request.
6. If rejected:
   - Decrease reserved_quantity.
   - Transfer status = REJECTED.
7. If approved:
   - Start DB transaction.
   - Decrease source quantity.
   - Decrease source reserved_quantity.
   - Increase destination quantity.
   - Create stock movement records.
   - Transfer status = COMPLETED.
```

API:

```text
POST /transfers
GET /transfers
GET /transfers/:id
POST /transfers/:id/approve
POST /transfers/:id/reject
POST /transfers/:id/cancel
```

---

### 6.7 Stock Movement Ledger

Inventory table chỉ lưu current state.

Stock movement ledger lưu toàn bộ lịch sử thay đổi kho.

Movement types:

```text
IMPORT_IN
TRANSFER_OUT
TRANSFER_IN
ADJUSTMENT_IN
ADJUSTMENT_OUT
RESERVATION_CREATED
RESERVATION_RELEASED
RECONCILIATION_ADJUSTMENT
```

Fields:

```text
id
branch_id
component_id
movement_type
quantity_change
reference_type
reference_id
created_by
created_at
```

Lợi ích:

- Có audit trail rõ ràng.
- Dễ debug sai lệch tồn kho.
- Là nền tảng cho reconciliation job.
- Dễ làm report.

---

### 6.8 Reconciliation Module

Mục tiêu:

Kiểm tra tồn kho hiện tại có khớp với stock movement ledger hay không.

Daily reconciliation flow:

```text
1. Lambda scheduled by EventBridge runs daily.
2. System scans inventory.
3. For each branch/component:
   - Calculate expected quantity from stock_movements.
   - Compare with inventory.quantity.
4. If mismatch:
   - Create reconciliation issue.
   - Notify admin.
   - Save report.
```

Example:

```text
Current inventory.quantity = 124

From ledger:
Opening stock = 100
IMPORT_IN = +50
TRANSFER_OUT = -20
ADJUSTMENT_OUT = -5

Expected quantity = 125

Result:
Mismatch detected: expected 125, actual 124
```

API:

```text
GET /reconciliation/issues
GET /reconciliation/reports
POST /reconciliation/run
POST /reconciliation/issues/:id/resolve
```

---

### 6.9 Report Module

Mục tiêu:

- Low stock report.
- Inventory value report.
- Transfer history report.
- Import summary report.
- Export CSV/Excel async.

Report export flow:

```text
User requests export
  |
  v
Create export job
  |
  v
Push message to SQS
  |
  v
Report Lambda generates file
  |
  v
Upload report to S3
  |
  v
User downloads by presigned URL
```

API:

```text
GET /reports/low-stock
GET /reports/inventory-value
POST /reports/export
GET /reports/export/:jobId
GET /reports/export/:jobId/download
```

---

### 6.10 Audit Module

Mục tiêu:

Ghi lại các hành động quan trọng.

Audit actions:

```text
USER_LOGIN
IMPORT_CREATED
IMPORT_STARTED
IMPORT_CONFIRMED
IMPORT_COMPLETED
TRANSFER_CREATED
TRANSFER_APPROVED
TRANSFER_REJECTED
INVENTORY_ADJUSTED
REPORT_EXPORTED
DLQ_MESSAGE_REPLAYED
RECONCILIATION_RUN
```

Audit fields:

```text
id
actor_id
action
entity_type
entity_id
before_data
after_data
ip_address
user_agent
created_at
```

---

### 6.11 DLQ Replay Module

Mục tiêu:

Không chỉ để message lỗi nằm trong DLQ, mà có thể xem và replay an toàn.

API:

```text
GET /admin/dlq/imports
POST /admin/dlq/imports/:messageId/replay
POST /admin/dlq/imports/:messageId/discard
```

Yêu cầu:

- Replay phải an toàn nhờ idempotency.
- Ghi audit log khi replay/discard.
- Có CloudWatch alarm nếu DLQ có message.

---

## 7. Excel Template

Các cột chung:

```text
sku
name
brand
category
quantity
unit_price
supplier
warranty_months
```

Các cột specs:

```text
ddr_generation
speed_mhz
capacity_gb
socket
cores
threads
interface
form_factor
vram_gb
chipset
```

Example:

| sku                 | name                 | brand    | category | quantity | unit_price | supplier | warranty_months | ddr_generation | speed_mhz | capacity_gb | socket  | cores | interface |
| ------------------- | -------------------- | -------- | -------- | -------: | ---------: | -------- | --------------: | -------------- | --------: | ----------: | ------- | ----: | --------- |
| RAM-KING-8-DDR4     | Kingston 8GB DDR4    | Kingston | RAM      |       20 |     550000 | ABC      |              36 | DDR4           |      3200 |           8 |         |       |           |
| CPU-INTEL-I5-12400F | Intel Core i5 12400F | Intel    | CPU      |        8 |    3200000 | XYZ      |              36 |                |           |             | LGA1700 |     6 |           |
| SSD-SAM-980-1TB     | Samsung 980 1TB      | Samsung  | SSD      |       15 |    1600000 | DEF      |              60 |                |           |        1000 |         |       | NVMe      |

---

## 8. Validation Rules

### 8.1 Common Validation

Required:

```text
sku
name
category
quantity
unit_price
```

Rules:

```text
sku must be unique within file
sku must not be empty
category must be valid
quantity must be >= 0
unit_price must be >= 0
warranty_months must be >= 0
```

### 8.2 RAM Validation

Required:

```text
ddr_generation
speed_mhz
capacity_gb
```

Allowed ddr_generation:

```text
DDR3
DDR4
DDR5
```

### 8.3 CPU Validation

Required:

```text
socket
cores
```

Rules:

```text
cores > 0
threads >= cores if provided
```

### 8.4 SSD Validation

Required:

```text
interface
capacity_gb
```

Allowed interface:

```text
NVMe
SATA
```

### 8.5 GPU Validation

Required:

```text
vram_gb
```

Rules:

```text
vram_gb > 0
```

### 8.6 Mainboard Validation

Required:

```text
socket
chipset
```

---

## 9. Database Schema Draft

### 9.1 users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) NOT NULL,
  branch_id UUID,
  status VARCHAR(50) DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### 9.2 branches

```sql
CREATE TABLE branches (
  id UUID PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  status VARCHAR(50) DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### 9.3 components

```sql
CREATE TABLE components (
  id UUID PRIMARY KEY,
  sku VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(100),
  category VARCHAR(50) NOT NULL,
  specs JSONB,
  unit_price NUMERIC(12, 2),
  supplier VARCHAR(255),
  warranty_months INT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### 9.4 inventory

```sql
CREATE TABLE inventory (
  branch_id UUID NOT NULL REFERENCES branches(id),
  component_id UUID NOT NULL REFERENCES components(id),
  quantity INT NOT NULL DEFAULT 0,
  reserved_quantity INT NOT NULL DEFAULT 0,
  min_stock_threshold INT DEFAULT 5,
  version INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (branch_id, component_id)
);
```

### 9.5 import_jobs

```sql
CREATE TABLE import_jobs (
  id UUID PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES branches(id),
  file_name VARCHAR(255),
  s3_key TEXT,
  status VARCHAR(50) NOT NULL,
  total_rows INT DEFAULT 0,
  processed_rows INT DEFAULT 0,
  valid_rows INT DEFAULT 0,
  invalid_rows INT DEFAULT 0,
  committed_rows INT DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  completed_at TIMESTAMP
);
```

### 9.6 import_job_rows

```sql
CREATE TABLE import_job_rows (
  id UUID PRIMARY KEY,
  import_job_id UUID NOT NULL REFERENCES import_jobs(id),
  row_number INT NOT NULL,
  sku VARCHAR(100),
  raw_data JSONB,
  normalized_data JSONB,
  validation_status VARCHAR(50),
  error_message TEXT,
  idempotency_key VARCHAR(255) UNIQUE,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);
```

### 9.7 transfers

```sql
CREATE TABLE transfers (
  id UUID PRIMARY KEY,
  from_branch_id UUID NOT NULL REFERENCES branches(id),
  to_branch_id UUID NOT NULL REFERENCES branches(id),
  status VARCHAR(50) NOT NULL,
  requested_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  rejected_by UUID REFERENCES users(id),
  note TEXT,
  reject_reason TEXT,
  created_at TIMESTAMP DEFAULT now(),
  approved_at TIMESTAMP,
  rejected_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

### 9.8 transfer_items

```sql
CREATE TABLE transfer_items (
  id UUID PRIMARY KEY,
  transfer_id UUID NOT NULL REFERENCES transfers(id),
  component_id UUID NOT NULL REFERENCES components(id),
  quantity INT NOT NULL
);
```

### 9.9 stock_movements

```sql
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES branches(id),
  component_id UUID NOT NULL REFERENCES components(id),
  movement_type VARCHAR(50) NOT NULL,
  quantity_change INT NOT NULL,
  reference_type VARCHAR(50),
  reference_id UUID,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now()
);
```

### 9.10 audit_logs

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  actor_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  before_data JSONB,
  after_data JSONB,
  ip_address VARCHAR(100),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT now()
);
```

### 9.11 reconciliation_issues

```sql
CREATE TABLE reconciliation_issues (
  id UUID PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES branches(id),
  component_id UUID NOT NULL REFERENCES components(id),
  expected_quantity INT NOT NULL,
  actual_quantity INT NOT NULL,
  difference INT NOT NULL,
  status VARCHAR(50) DEFAULT 'OPEN',
  detected_at TIMESTAMP DEFAULT now(),
  resolved_at TIMESTAMP
);
```

---

## 10. API Summary

### Auth

```text
POST /auth/login
GET /auth/me
```

### Branches

```text
GET /branches
GET /branches/:id
POST /branches
PATCH /branches/:id
```

### Inventory

```text
GET /inventory
GET /inventory/:sku
GET /branches/:branchId/inventory
PATCH /inventory/:id
GET /reports/low-stock
```

### Imports

```text
POST /imports/init
POST /imports/:id/start
GET /imports
GET /imports/:id
GET /imports/:id/progress
GET /imports/:id/errors
GET /imports/:id/preview
POST /imports/:id/confirm
POST /imports/:id/cancel
POST /imports/:id/retry-failed-rows
```

### Transfers

```text
POST /transfers
GET /transfers
GET /transfers/:id
POST /transfers/:id/approve
POST /transfers/:id/reject
POST /transfers/:id/cancel
```

### Reports

```text
GET /reports/low-stock
GET /reports/inventory-value
POST /reports/export
GET /reports/export/:jobId
GET /reports/export/:jobId/download
```

### Reconciliation

```text
GET /reconciliation/issues
GET /reconciliation/reports
POST /reconciliation/run
POST /reconciliation/issues/:id/resolve
```

### Admin DLQ

```text
GET /admin/dlq/imports
POST /admin/dlq/imports/:messageId/replay
POST /admin/dlq/imports/:messageId/discard
```

---

## 11. Important Business Rules

### 11.1 Branch Access Rule

Store Manager chỉ được thao tác trên branch của mình.

```text
If user.role = STORE_MANAGER:
  user.branch_id must match resource.branch_id
```

Admin có thể xem toàn bộ branch.

Warehouse có quyền tùy cấu hình.

---

### 11.2 Import Rule

Import không được commit inventory ngay sau khi upload.

Flow đúng:

```text
Upload
→ Parse
→ Validate
→ Preview
→ Confirm
→ Commit
```

Lý do:

- Tránh cộng kho sai.
- Cho user sửa file nếu có lỗi.
- Cho user biết import sẽ ảnh hưởng tồn kho như thế nào.

---

### 11.3 Idempotency Rule

Mỗi import row phải có idempotency key.

Example:

```text
idempotency_key = hash(import_job_id + row_number + sku)
```

Nếu Lambda/SQS retry, hệ thống kiểm tra key này trước.

Nếu row đã processed:

```text
skip
```

Nếu chưa processed:

```text
process normally
```

Mục tiêu:

- Không cộng kho hai lần.
- Retry an toàn.

---

### 11.4 Transfer Reservation Rule

Khi tạo transfer pending, hệ thống reserve stock.

Example:

```text
quantity = 10
reserved_quantity = 4
available_quantity = 6
```

Nếu user muốn transfer 8 nhưng available chỉ có 6:

```text
reject request
```

---

### 11.5 Transfer Approval Rule

Approve transfer phải dùng database transaction.

Trong transaction:

```text
1. Check transfer status = PENDING.
2. Check source inventory has enough reserved quantity.
3. Decrease source quantity.
4. Decrease source reserved_quantity.
5. Increase destination quantity.
6. Create TRANSFER_OUT stock movement.
7. Create TRANSFER_IN stock movement.
8. Update transfer status = COMPLETED.
```

Nếu bất kỳ bước nào lỗi:

```text
rollback
```

---

### 11.6 Optimistic Locking Rule

Inventory update nên dùng `version`.

Example:

```sql
UPDATE inventory
SET quantity = quantity - 5,
    version = version + 1
WHERE branch_id = $1
  AND component_id = $2
  AND quantity >= 5
  AND version = $3;
```

Nếu affected rows = 0:

```text
stock changed by another request or insufficient quantity
```

---

## 12. Observability Plan

### Logs

Dùng structured logging.

Mỗi request/job nên có:

```text
correlation_id
user_id
import_job_id
transfer_id
branch_id
status
duration_ms
error_code
```

### Metrics

Import metrics:

```text
ImportJobCount
ImportJobFailedCount
ImportDuration
RowsProcessed
RowsFailed
ImportRetryCount
```

Transfer metrics:

```text
TransferRequestedCount
TransferApprovedCount
TransferRejectedCount
TransferFailedCount
StockUpdateConflictCount
```

System metrics:

```text
LambdaErrorRate
LambdaDuration
APIGateway5xx
SQSQueueDepth
DLQMessageCount
DatabaseConnectionCount
```

### Alarms

Create alarms for:

```text
DLQMessageCount > 0
LambdaErrorRate > threshold
APIGateway5xx > threshold
SQSApproximateAgeOfOldestMessage > threshold
ImportJobFailedCount too high
```

### Dashboard

Dashboard should show:

```text
Import success/failure rate
Average import duration
Rows processed
Top validation errors
Transfer volume
Low stock count
DLQ messages
Lambda errors
SQS queue depth
```

---

## 13. Security Plan

### Authentication

Options:

- Cognito
- Custom JWT

MVP có thể dùng custom JWT.

Production-style version nên dùng Cognito.

### Authorization

Use RBAC + branch-level access control.

### S3 Security

Rules:

```text
S3 bucket private
Upload using presigned URL
Presigned URL expires quickly
Limit file size
Validate content type
Use SSE-S3 or SSE-KMS
```

### IAM

Apply least privilege:

```text
Import Lambda can only read imports/*
Report Lambda can only write reports/*
API Lambda can only access required resources
```

### Secrets

Database credentials should be stored in:

```text
AWS Secrets Manager
```

### Validation

Validate:

```text
API body
query params
Excel rows
file name
file size
content type
```

---

## 14. Failure Handling

### Import Lambda Fails

Expected behavior:

```text
SQS retries message.
If retry limit exceeded, message goes to DLQ.
Import job status becomes FAILED or PARTIAL_FAILED.
Admin can replay DLQ message.
Idempotency prevents duplicated stock updates.
```

### Database Timeout During Import

Expected behavior:

```text
Batch fails.
Message is retried.
Already processed rows are skipped.
Failed rows are logged.
```

### Transfer Approval Fails

Expected behavior:

```text
Database transaction rolls back.
Inventory remains consistent.
Transfer status stays PENDING or becomes FAILED depending on failure stage.
Audit log records failure.
```

### Two Admins Approve Same Transfer

Expected behavior:

```text
Only one transaction succeeds.
Second transaction fails because transfer status is no longer PENDING.
```

### Stock Mismatch Detected

Expected behavior:

```text
Reconciliation job creates issue.
Admin reviews issue.
Admin can resolve or create adjustment.
```

---

## 15. Roadmap

### Phase 1 — MVP

Goal: make the core flow work.

Features:

```text
Auth mock/custom JWT
Branch seed data
Excel upload
Parse Excel
Validate rows
Save import job
Save row errors
Inventory list
Search/filter
Create transfer
Approve transfer
Basic low stock report
```

### Phase 2 — AWS Junior Version

Goal: add serverless architecture.

Features:

```text
S3 presigned upload
Lambda import processor
SQS import queue
Import progress tracking
CloudWatch logs
Export CSV/Excel
Basic RBAC
```

### Phase 3 — Middle Version

Goal: production-style reliability.

Features:

```text
Step Functions import workflow
Import preview + confirmation
Idempotency
DLQ
DLQ replay
Stock movement ledger
Stock reservation
Optimistic locking
Audit logs
CloudWatch metrics/alarms/dashboard
IaC
CI/CD
Integration tests
```

### Phase 4 — Middle+ Version

Goal: stronger platform design.

Features:

```text
Daily reconciliation job
EventBridge events
Notification service
Async report generation
X-Ray tracing
Performance benchmark
Cost optimization
ADR docs
Architecture diagram
```

---

## 16. Suggested Folder Structure

```text
eims/
  apps/
    web/
      src/
        pages/
        components/
        features/
        api/
        stores/
    api/
      src/
        modules/
          auth/
          branches/
          components/
          inventory/
          imports/
          transfers/
          reports/
          audit/
          reconciliation/
          dlq/
        common/
        config/
        database/
        main.ts
  infrastructure/
    terraform/
      modules/
      envs/
        dev/
        staging/
        prod/
  docs/
    architecture.md
    database-schema.md
    api.md
    failure-handling.md
    performance.md
    demo-script.md
    adr/
      001-use-postgresql-for-core-inventory.md
      002-use-s3-presigned-url-for-upload.md
      003-use-sqs-for-async-import.md
      004-use-step-functions-for-import-orchestration.md
      005-use-stock-movement-ledger.md
      006-use-optimistic-locking.md
  scripts/
    seed.ts
    generate-sample-excel.ts
  README.md
```

---

## 17. Demo Script

Use this script to demonstrate the system:

```text
1. Login as Store Manager.
2. Open Import page.
3. Upload Excel with mixed valid and invalid rows.
4. Watch import progress.
5. Open import preview.
6. Show valid rows, invalid rows, estimated inventory changes.
7. Confirm import.
8. Open Inventory page.
9. Search SKU and filter by category.
10. Show updated stock.
11. Create transfer request from Branch A to Branch B.
12. Show reserved quantity updated.
13. Login as Admin/Warehouse.
14. Approve transfer.
15. Show Branch A quantity decreased and Branch B quantity increased.
16. Open stock movement ledger.
17. Show TRANSFER_OUT and TRANSFER_IN records.
18. Open low stock report.
19. Trigger/export report.
20. Show CloudWatch dashboard and alarms.
```

---

## 18. Performance Targets

Initial target:

```text
Support 100 branches
Support 100,000 SKUs
Support Excel imports up to 50,000 rows
Process import in batches of 500 rows
Support 100 concurrent users
Prevent duplicated stock updates during retry
Keep audit logs for 1 year
Keep raw import files for 30 days
Keep exported reports for 90 days
```

Benchmark document should include:

```text
Test file size
Number of rows
Batch size
Average processing time
Failed row count
Lambda memory
Lambda duration
Database write time
SQS retry count
```

---

## 19. What Makes This Project Impressive

This project is impressive because it is not just CRUD.

It demonstrates:

```text
Serverless architecture
Async processing
Excel import pipeline
Idempotency
Retry safety
DLQ replay
Inventory consistency
Transaction handling
Optimistic locking
Stock reservation
Stock movement ledger
Audit logging
Reconciliation job
CloudWatch observability
Security best practices
IaC
CI/CD
Performance thinking
```

---

## 20. CV Pitch

### English

```text
Designed and built a serverless multi-branch electronics inventory platform using AWS Lambda, API Gateway, S3, SQS, Step Functions, PostgreSQL, and CloudWatch.

Implemented an asynchronous Excel import pipeline with preview, row-level validation, idempotent batch processing, retry handling, DLQ replay, and progress tracking.

Designed a transfer approval workflow with stock reservation, transactional inventory updates, optimistic locking, stock movement ledger, audit logs, and daily reconciliation jobs.

Built operational monitoring with structured logs, custom CloudWatch metrics, alarms, dashboards, and failure tracking for import and transfer workflows.

Provisioned AWS infrastructure using Terraform/CDK and configured CI/CD pipeline with automated tests and environment-based deployments.
```

### Vietnamese

```text
Thiết kế và xây dựng nền tảng quản lý kho linh kiện điện tử đa chi nhánh bằng AWS Lambda, API Gateway, S3, SQS, Step Functions, PostgreSQL và CloudWatch.

Triển khai pipeline import Excel bất đồng bộ với preview, validate từng dòng, xử lý batch idempotent, retry, DLQ replay và theo dõi tiến độ.

Thiết kế workflow chuyển kho có stock reservation, transaction cập nhật tồn kho, optimistic locking, stock movement ledger, audit log và reconciliation job hằng ngày.

Xây dựng monitoring với structured logs, custom CloudWatch metrics, alarms, dashboard và failure tracking cho import/transfer workflow.

Triển khai hạ tầng bằng Terraform/CDK và CI/CD pipeline với automated test theo từng môi trường.
```

---

## 21. First Coding Milestone

Before building everything, start with this small vertical slice:

```text
1. Create PostgreSQL schema for branches, components, inventory, import_jobs, import_job_rows.
2. Seed 2 branches and 2 users.
3. Build POST /imports/init.
4. Upload Excel locally first or via S3 presigned URL.
5. Parse Excel.
6. Validate rows.
7. Save import preview.
8. Confirm import.
9. Update inventory.
10. Show inventory table on frontend.
```

After this works, add:

```text
SQS
Lambda
Step Functions
DLQ
CloudWatch metrics
Transfer workflow
Stock reservation
Reconciliation job
```

Do not start with all AWS services at once. Build the business flow first, then make it serverless and production-ready.

---

## 22. Final Scope Decision

The recommended final version for portfolio:

```text
Serverless multi-branch inventory platform with asynchronous Excel import, import preview, idempotent batch processing, transfer approval workflow, stock reservation, transactional inventory updates, stock movement ledger, reconciliation job, DLQ replay, and CloudWatch observability.
```

This scope is strong enough for a Middle Backend with AWS portfolio project.
