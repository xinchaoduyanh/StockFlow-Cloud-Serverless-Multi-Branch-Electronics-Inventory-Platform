# StockFlow Cloud — Terraform Roadmap (học từng bước)

> Mục tiêu: dựng toàn bộ hạ tầng AWS bằng Terraform từ đầu, chia 9 phase nhỏ.
> Mỗi phase đều `terraform apply` được độc lập và thấy kết quả ngay → học tới đâu chắc tới đó.
>
> **Yêu cầu thiết kế đặc biệt: hệ thống BẬT/TẮT được** — build xong demo, tắt đi để không tốn tiền,
> cần thì bật lại. Xem mục "Thiết kế Bật/Tắt" ở cuối.

## Kiến trúc đích

```
vuduyanh.id.vn ──► CloudFront ──► S3 (Next.js static export, private + OAC)
api.vuduyanh.id.vn ──► ALB (HTTPS, ACM) ──► ECS Fargate (NestJS container từ ECR)
                                              │ env: Cognito, Pusher, S3 bucket, 3 Lambda ARNs
                                              │ secrets: DATABASE_URL (Secrets Manager)
                                              ▼
                              Aurora Serverless v2 PostgreSQL (private subnets,
                              min 0 ACU → tự pause khi không dùng)
                                              ▲
Upload Excel ──► S3 imports bucket ──► EventBridge ──► Step Functions
                                          ├─ Validator Lambda      ┐
                                          ├─ Parser Lambda         │ chạy TRONG VPC
                                          ├─ ApprovalTokenRegister │ (để nối Aurora)
                                          ├─ Writer Lambda ──► SNS │
                                          └─ FailHandler ──► SNS   ┘
Cron 02:00 UTC ──► Reconciliation Lambda
API ──► report-jobs SQS ──► ReportExporter Lambda ──► report-jobs-dlq
Step Functions terminal events ──► import-recovery SQS ──► import-recovery-worker
```

**Nằm ngoài Terraform (truyền vào bằng variable / data source):** Cognito User Pool/Client (đã tạo sẵn), Pusher, ACM certs (đã validate sẵn — đọc bằng `data`), DNS (trỏ tay trên dashboard domain).

**Thay đổi so với hiện trạng:** Neon Postgres → **Aurora Serverless v2** do Terraform tự dựng, tự sinh password, tự ghép `DATABASE_URL` đẩy vào Secrets Manager rồi inject vào API + Lambdas.

## Cấu trúc thư mục đề xuất

```
infrastructure/terraform/
├── versions.tf      # providers: aws (ap-southeast-1) + aws.us_east_1 + time, default_tags
├── variables.tf     # domain, cognito ids, pusher keys, system_on, enable_nat...
├── terraform.tfvars # giá trị thật (KHÔNG commit — thêm *.tfvars vào .gitignore ngay)
├── network.tf       # Phase 2
├── database.tf      # Phase 3 (Aurora Serverless v2 + Secrets Manager)
├── serverless.tf    # Phase 4 (S3 imports, Lambdas, Step Functions, SNS, EventBridge)
├── ecr.tf           # Phase 5 (ECR + docker build/push tự động)
├── ecs.tf + alb.tf  # Phase 6
├── frontend.tf      # Phase 7 (S3 web + CloudFront)
└── outputs.tf       # ALB DNS, CloudFront domain, bucket names, secret ARN
```

Bắt đầu dạng file phẳng cho dễ hiểu; khi chạy ổn rồi mới refactor sang modules (Phase 9).

---

## Phase 0 — Chuẩn bị (kết quả audit 2026-06-10)

Đã kiểm tra máy local + tài khoản AWS (account `186818869522`, IAM user `stockflowcloud`, region `ap-southeast-1`):

✅ **Sẵn sàng:** AWS CLI 2.35 + credentials hoạt động, Docker 29.2, Node v20, SAM CLI 1.161 (để xóa stack cũ).

❌ **Việc phải làm trước Phase 1:**

- [x] **Cài Terraform**: v1.15.5, cài thủ công tại `C:\terraform` (đã có trong PATH)
- [x] **Nâng quyền IAM** (làm xong 2026-06-10): user `stockflowcloud` giờ chỉ gắn duy nhất `AdministratorAccess` (đã gỡ 9 policy cũ). Access key giữ nguyên, không cần tạo mới.
- [x] **ACM certs — ĐỦ CẢ 2 REGION, đều ISSUED**: `api.vuduyanh.id.vn` + `vuduyanh.id.vn` ở ap-southeast-1 (ALB), `vuduyanh.id.vn` ở us-east-1 (CloudFront). Chỉ cần `data` lookup.
- [x] **Cognito** (điền vào tfvars): User Pool `ap-southeast-1_ITWsr9wwd`, App Client `4sqtgvsdfb2n3ko6j70a59u6ec` (stockflow-web)
- [x] Thêm `*.tfvars` + `*.tfstate` + `.terraform/` vào `.gitignore`

📋 **Hạ tầng cũ đã phát hiện — kế hoạch dọn dẹp** (hiện tại 0 task chạy, không có ALB → gần như không tốn tiền, KHÔNG cần dọn gấp):

| Thứ đang tồn tại                                                                                                                                      | Dọn khi nào                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack SAM **`stockflow-pipeline`** (tên thật, không phải `stockflow-serverless-pipeline` như README) — 8 Lambda, Step Functions, bucket imports       | **Phase 4**, TRƯỚC khi apply — vì bucket `stockflow-imports-186818869522-ap-southeast-1` trùng tên với bucket Terraform sẽ tạo                           |
| ECS cluster `stockflow-ecs` + service tạo bằng console (2 stack `Infra-ECS-Cluster-...` + `ECS-Console-V2-...`, 0 task)                               | Phase 6, trước khi apply                                                                                                                                 |
| **CloudFront distribution cũ `E2L4RUB4YKMQ6A`** đang giữ aliases `vuduyanh.id.vn` + `www.vuduyanh.id.vn` (origin bucket FE đã bị xóa → distro mồ côi) | **Phase 7, TRƯỚC khi apply** — CloudFront không cho 2 distribution trùng alias (`CNAMEAlreadyExists`); phải disable → delete distro cũ (mất ~15-20 phút) |
| ~~Bucket `stockflow-frontend-production`~~, ~~`stockflow-configs`~~                                                                                   | Đã biến mất khi recheck 2026-06-10 (có vẻ đã được xóa tay)                                                                                               |
| `npm run build:lambdas` (dist/lambdas chưa build)                                                                                                     | Trước Phase 4                                                                                                                                            |

## Phase 1 — Bootstrap (làm quen Terraform) ✅ XONG 2026-06-11 (user tự viết lại toàn bộ file)

File thực tế: `version.tf` (aws ~> 6.0 + alias us_east_1, time, default_tags qua `time_static`), `variable.tf` (project, aws_region), `main.tf` (bucket test, đã xóa). Đã chạy trọn vòng đời: init → plan → apply bucket test → verify 3 tag tự gắn trên console → outputs → xóa code → apply (bucket biến mất). State local serial 8, chỉ còn `time_static.created = 2026-06-11T07:01:34Z` (GIỮ LẠI — ngày khai sinh stack).
📚 Bug đã gặp & hiểu: lần apply khai sinh `time_static`, giá trị `rfc3339` còn "(known after apply)" → provider default_tags chưa gắn tag được trong cùng lượt; apply lần 2 mới gắn. Chỉ xảy ra 1 lần duy nhất.

- [x] Cài Terraform (>= 1.7), `aws configure` profile có quyền admin sandbox
- [x] `versions.tf`: provider `aws` region `ap-southeast-1` + provider alias `us_east_1` (cho CloudFront cert) + provider `time`
- [x] **Gắn "ngày giờ khởi tạo" cho TOÀN BỘ resource** bằng `default_tags` trên provider:

  ```hcl
  resource "time_static" "created" {}   # ghi lại thời điểm apply đầu tiên, KHÔNG đổi ở các lần sau

  provider "aws" {
    region = var.aws_region
    default_tags {
      tags = {
        Project   = "stockflow"
        ManagedBy = "terraform"
        CreatedAt = time_static.created.rfc3339   # vd 2026-06-10T09:30:00Z
      }
    }
  }
  ```

  > ⚠️ Đừng dùng `timestamp()` trong tags — nó đổi mỗi lần plan → Terraform báo drift toàn bộ resource mãi mãi. `time_static` chỉ ghi 1 lần lúc tạo, đúng ý "biết cái này build lúc nào, lỡ quên xóa thì sau nhìn tag là biết tạo từ bao giờ".

- [x] `variables.tf` + gitignore (`*.tfstate`, `*.tfvars` đã vào .gitignore; tfvars sẽ tạo ở Phase 2+ khi có biến cần truyền thật)
- [x] State: **local state** cho dễ học (Phase 9 mới chuyển S3 backend)
- [x] Chạy thử: `terraform init` → tạo 1 bucket test → `plan` → `apply` → vào console xem tags → xóa code → apply (destroy)

**Khái niệm học được:** provider, resource, variable, output, state, plan/apply/destroy, default_tags.

## Phase 2 — Network (VPC, Subnets, NAT, Security Groups)

- [ ] VPC `10.0.0.0/16`, 2 AZ
- [ ] 2 public subnets (ALB, NAT) + 2 private subnets (Fargate, Aurora, Lambdas)
- [ ] Internet Gateway + route tables
- [ ] **NAT Gateway có công tắc** (đã chốt dùng NAT vì hệ thống bật/tắt được):
  ```hcl
  resource "aws_nat_gateway" "main" {
    count = var.system_on ? 1 : 0   # tắt hệ thống = NAT biến mất = hết ~$32/tháng
    ...
  }
  ```
  (route table private trỏ NAT cũng dùng count tương ứng)
- [ ] **S3 Gateway Endpoint** (miễn phí) — Lambda/ECS trong private subnet đọc ghi S3 không qua NAT, đỡ tiền data
- [ ] Security Groups:
  - `alb_sg`: ingress 80 + 443 từ `0.0.0.0/0`
  - `api_sg`: ingress 3000 **chỉ từ `alb_sg`**
  - `lambda_sg`: chỉ cần egress
  - `db_sg`: ingress 5432 **chỉ từ `api_sg` + `lambda_sg`**

**Khái niệm:** VPC/subnet/route table, SG reference SG, `count` làm công tắc bật/tắt, VPC endpoint.

## Phase 3 — Database: Aurora Serverless v2 + Secrets Manager 🆕

> Thay Neon bằng PostgreSQL serverless "chính chủ" AWS, Terraform dựng và truyền thẳng vào API/Lambdas.

- [ ] `random_password` sinh master password (không bao giờ gõ tay)
- [ ] `aws_rds_cluster`: engine `aurora-postgresql` (chọn version PG mới, >= 15.7 để hỗ trợ scale-to-zero), `engine_mode = "provisioned"` +

  ```hcl
  serverlessv2_scaling_configuration {
    min_capacity             = 0     # 0 ACU = tự PAUSE khi không có kết nối
    max_capacity             = 2
    seconds_until_auto_pause = 600   # ngủ sau 10 phút im lặng
  }
  ```

  - 1 `aws_rds_cluster_instance` class `db.serverless`, đặt ở private subnets (`aws_db_subnet_group`), gắn `db_sg`, `skip_final_snapshot = true` (đồ án — cho destroy nhanh)

- [ ] **Secrets Manager** (chuẩn production):
  - `aws_secretsmanager_secret` `stockflow/database-url` → value = `postgresql://user:pass@<cluster-endpoint>:5432/stockflow?connection_limit=1` (Terraform tự ghép từ output cluster)
  - `recovery_window_in_days = 0` để destroy là xóa ngay (mặc định giữ 7–30 ngày sẽ kẹt tên secret khi tạo lại)
  - Lưu ý phí: ~$0.40/secret/tháng
  - 📝 Về `JWT_SECRET`: tôi đã soát code — **API không dùng JWT_SECRET ở bất kỳ đâu** (auth 100% Cognito, `env.schema.ts` cũng không khai báo). Biến này là config chết trong `.env.example`. Không cần tạo secret cho nó; nếu sau này thêm JWT thì tạo `aws_secretsmanager_secret` thứ 2 theo đúng pattern trên.
- [ ] **Chạy Prisma migration** (DB nằm private subnet, máy bạn không nối thẳng được) — chọn 1:
  - **Khuyên dùng**: one-off ECS task (image API đã chứa sẵn thư mục `prisma/`): `aws ecs run-task ... --overrides '{"containerOverrides":[{"command":["npx","prisma","migrate","deploy"]}]}'` — làm được sau Phase 6
  - Tạm thời lúc học: mở instance `publicly_accessible = true` + `db_sg` thêm ingress từ IP nhà bạn, migrate từ máy local, xong khóa lại

**Điểm hay với hệ thống bật/tắt:** API Fargate giữ connection pool → DB không pause khi API đang chạy; tắt ECS (Phase 6) → hết kết nối → 10 phút sau Aurora tự ngủ, chi phí compute = 0 (vẫn trả tiền storage ~$0.1/GB/tháng). Đánh đổi: request đầu tiên sau khi ngủ mất ~15s để DB thức dậy.

**Khái niệm:** random_password, Secrets Manager, RDS cluster vs instance, subnet group, scale-to-zero.

## Phase 4 — Serverless stack (port từ `apps/lambdas/template.yaml`)

> Làm trước Fargate vì API cần output của phase này (bucket name + 3 Lambda ARN).

- [ ] `npm run build:lambdas` → `dist/lambdas/<tên>/index.js`; dùng `data "archive_file"` zip từng folder
- [ ] S3 bucket `stockflow-imports-<account>-<region>`: bật EventBridge notification, CORS (AllowedOrigins: `https://vuduyanh.id.vn` + `http://localhost:3000` — đừng để `*` như SAM cũ), **`force_destroy = true`** (cho phép destroy kể cả khi còn file)
- [ ] SNS topic `stockflow-notifications-...`
- [ ] 8 Lambda functions — **khác SAM cũ: tất cả phải có `vpc_config`** (private subnets + `lambda_sg`) vì giờ DB nằm trong VPC:
      | Lambda | Quyền riêng | Env riêng |
      |---|---|---|
      | import-validator | s3 Get/PutObject trên bucket | — |
      | import-parser | s3 GetObject, timeout 300s, mem 512 | — |
      | import-approval-token-register | — | — |
      | import-writer | sns:Publish, timeout 180s | `NOTIFICATION_SNS_TOPIC_ARN` |
      | import-job-fail-handler | sns:Publish | `NOTIFICATION_SNS_TOPIC_ARN` |
      | report-exporter | s3 PutObject `reports/*`, timeout 120s, mem 512 | — |
      | import-recovery-worker | SQS partial-batch persistence + stale scan | — |
      | reconciliation | timeout 300s, mem 512 | — |
  - Mỗi Lambda 1 IAM role riêng; role nào cũng cần thêm `AWSLambdaVPCAccessExecutionRole` (tạo ENI trong VPC)
  - Env chung: `DATABASE_URL`, `S3_BUCKET`; runtime `nodejs20.x`, arch `arm64`, handler `index.handler`
  - `DATABASE_URL` cho Lambda: đọc từ secret bằng `data "aws_secretsmanager_secret_version"` rồi nhét vào env (giá trị sẽ hiện trong console Lambda — chấp nhận được với đồ án; chuẩn hơn nữa thì dùng Secrets Manager Lambda Extension, để Phase 9)
  - ⚠️ Aurora không có pgbouncer như Neon → giữ `connection_limit=1` trong URL là bắt buộc; nếu sau này import song song lớn mới cần RDS Proxy (tốn thêm phí, chưa cần)
  - OTel layer + `AWS_LAMBDA_EXEC_WRAPPER=/opt/otel-handler`: bỏ qua ở lần đầu cho gọn, thêm lại sau
- [ ] Step Functions `aws_sfn_state_machine`: definition `jsonencode()` y nguyên các state ValidateFileStructure → CheckIntegrity → ParseAndStageRows → HaltForUserApproval (waitForTaskToken) → CommitInventory / MarkJobFailed; role cho phép `lambda:InvokeFunction` 5 hàm
- [ ] EventBridge rule: `source=aws.s3, detail-type=Object Created, key prefix imports/` + input_transformer `{bucket, key, size}` → target state machine (role có `states:StartExecution`)
- [ ] EventBridge schedule `cron(0 2 * * ? *)` → reconciliation + `aws_lambda_permission`
- [ ] Test: upload file vào `imports/` → xem execution trong Step Functions console
- [ ] ⚠️ TRƯỚC khi apply phase này: **xóa stack SAM cũ `stockflow-pipeline`** (`aws cloudformation delete-stack --stack-name stockflow-pipeline`) — bucket imports cũ trùng tên với bucket Terraform sẽ tạo; nếu bucket còn file thì phải dọn sạch trước khi CloudFormation xóa được nó

**Khái niệm:** archive_file, IAM role/policy, vpc_config cho Lambda, jsonencode, lambda_permission.

## Phase 5 — ECR + build/push image TỰ ĐỘNG trong Terraform

> Trả lời câu hỏi "Phase này không build tự động cùng Terraform được à?" — **Được**, bằng `terraform_data` + provisioner `local-exec`:

- [ ] `aws_ecr_repository "stockflow-api"`: + `force_delete = true` (destroy được kể cả còn image) + lifecycle policy giữ 5 image gần nhất
- [ ] Build & push tự động, image tag = ngày giờ + git sha (biết image build lúc nào, từ commit nào):

  ```hcl
  locals {
    image_tag = formatdate("YYYYMMDD-hhmmss", timestamp())
  }

  resource "terraform_data" "api_image" {
    # đổi code api/shared → hash đổi → tự build lại ở lần apply sau
    triggers_replace = sha1(join("", [for f in fileset("${path.module}/../../apps/api/src", "**") : filesha1("${path.module}/../../apps/api/src/${f}")]))

    provisioner "local-exec" {
      working_dir = "${path.module}/../.."   # ⚠️ build context là ROOT monorepo
      command     = <<-EOT
        aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${local.ecr_url}
        docker build -t ${aws_ecr_repository.api.repository_url}:${local.image_tag} -t ${aws_ecr_repository.api.repository_url}:latest -f apps/api/Dockerfile .
        docker push --all-tags ${aws_ecr_repository.api.repository_url}
      EOT
    }
  }
  ```

- [ ] Trade-off nên biết (để hiểu, không phải để sợ): `local-exec` nghĩa là máy chạy `terraform apply` phải có Docker; build có thể vài phút; Terraform không "thấy" image như resource thật. Đây là cách hợp lý cho đồ án/1 người; lên team thật thì tách sang CI/CD (Phase 9). Task definition ở Phase 6 sẽ trỏ tag `latest` + `depends_on` resource này.

**Khái niệm:** terraform_data, provisioner local-exec, triggers_replace, formatdate.

## Phase 6 — ECS Fargate + ALB + HTTPS (phần nặng nhất)

- [ ] ACM: `data "aws_acm_certificate"` lookup cert `api.vuduyanh.id.vn` ở **ap-southeast-1** (cert đã validate sẵn → chỉ đọc, destroy không ảnh hưởng cert)
- [ ] ALB ở public subnets + target group (target_type **`ip`** — bắt buộc Fargate, port 3000, health check **`/health`**)
- [ ] Listener 443 (cert ACM) → forward; Listener 80 → redirect 301 sang 443
- [ ] ECS cluster + Task Definition Fargate (CPU 512 / RAM 1024):
  - **Execution role**: `AmazonECSTaskExecutionRolePolicy` + `secretsmanager:GetSecretValue` trên secret DATABASE_URL
  - **Task role** (quyền runtime — nhờ vậy **bỏ hẳn `AWS_ACCESS_KEY_ID`/`SECRET` khỏi env**, SDK tự nhận credential):
    - `s3:PutObject/GetObject` trên imports bucket (presigned URL)
    - `sqs:SendMessage` report queue, `states:StartExecution` ingestion state machine, and reconciliation invoke
    - `states:SendTaskSuccess/SendTaskFailure` (confirm/cancel import)
    - `ses:SendEmail`
    - Cognito (lấy từ inline policy cũ của user stockflowcloud — đúng 6 action API cần, scope vào pool `ap-southeast-1_ITWsr9wwd`): `cognito-idp:AdminCreateUser`, `AdminDeleteUser`, `AdminGetUser`, `AdminUpdateUserAttributes`, `AdminDisableUser`, `AdminEnableUser`
  - `secrets`: `DATABASE_URL` ← valueFrom secret ARN (Phase 3)
  - `environment` (map từ `apps/api/src/config/env.schema.ts`):
    | Biến                                                                            | Giá trị                                                    |
    | ------------------------------------------------------------------------------- | ---------------------------------------------------------- |
    | `NODE_ENV` / `PORT`                                                             | `production` / `3000`                                      |
    | `CORS_ORIGIN` / `FRONTEND_URL`                                                  | `https://vuduyanh.id.vn`                                   |
    | `AWS_REGION` / `AWS_S3_BUCKET`                                                  | từ Phase 4                                                 |
    | `REPORT_QUEUE_URL` / `IMPORT_RECOVERY_QUEUE_URL` / `NOTIFICATION_SNS_TOPIC_ARN` | Terraform outputs                                          |
    | `COGNITO_REGION` / `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID`                 | variable                                                   |
    | `PUSHER_APP_ID` / `PUSHER_KEY` / `PUSHER_CLUSTER` / `PUSHER_SECRET`             | variable (secret nhỏ, có thể thêm vào Secrets Manager sau) |
    | `SWAGGER_ENABLED`                                                               | `false`                                                    |
- [ ] CloudWatch log group `/ecs/stockflow-api` (retention 14 ngày)
- [ ] ECS Service: private subnets, `api_sg`, gắn target group, **`desired_count = var.system_on ? 1 : 0`** ← công tắc tắt API
- [ ] Chạy migration lần đầu bằng one-off task (xem Phase 3)
- [ ] Test: `http://<alb_dns_name>/health`

**Khái niệm:** task definition, execution role vs task role, secrets valueFrom, target group ip mode.

## Phase 7 — Frontend: S3 + CloudFront + OAC

- [ ] ACM us-east-1: `data "aws_acm_certificate"` với `provider = aws.us_east_1` lookup cert `vuduyanh.id.vn`.
      ⚠️ Cert đã validate rồi, nhưng **CloudFront chỉ nhận cert nằm ở region us-east-1** — mở console ACM kiểm tra: nếu cert chỉ có ở ap-southeast-1 thì phải request thêm 1 cert us-east-1 (validate DNS lại bằng record CNAME trên dashboard domain — record validation cũ có thể dùng lại được nếu giữ nguyên)
- [ ] S3 bucket web: private hoàn toàn (block public access ON) + `force_destroy = true`
- [ ] CloudFront distribution:
  - Origin S3 + **OAC** (`aws_cloudfront_origin_access_control`) — chuẩn mới thay OAI
  - Bucket policy: chỉ cho `cloudfront.amazonaws.com` đọc, condition `AWS:SourceArn` = distribution ARN
  - `aliases = ["vuduyanh.id.vn"]`, viewer cert = ACM us-east-1, redirect-to-https
  - `default_root_object = "index.html"`; custom_error_response 403 + 404 → `/index.html` HTTP 200 (SPA routing)
- [ ] Build & deploy FE (script, ngoài Terraform):
  ```
  # apps/web/.env.production:
  # NEXT_PUBLIC_API_URL=https://api.vuduyanh.id.vn  (kiểm tra code có cần hậu tố /api không)
  # NEXT_PUBLIC_AUTH_MODE=cognito + COGNITO_*, PUSHER_KEY/CLUSTER
  npm run build:web
  aws s3 sync apps/web/out s3://<bucket>/ --delete
  aws cloudfront create-invalidation --distribution-id <id> --paths "/*"
  ```

## Phase 8 — DNS (làm tay trên dashboard domain)

`outputs.tf` in sẵn 2 giá trị, bạn lên dashboard nhà cung cấp domain trỏ:

| Record               | Type                                | Trỏ tới                |
| -------------------- | ----------------------------------- | ---------------------- |
| `api.vuduyanh.id.vn` | CNAME                               | `<alb_dns_name>`       |
| `vuduyanh.id.vn`     | ALIAS/ANAME (root không CNAME được) | `<xxx>.cloudfront.net` |

Nếu dashboard không hỗ trợ ALIAS ở root → dùng `www.vuduyanh.id.vn` (thêm vào aliases + cert), hoặc chuyển DNS sang Route 53.

⚠️ Lưu ý với hệ thống bật/tắt: nếu **destroy rồi apply lại**, ALB DNS name và CloudFront domain sẽ **đổi** → phải vào dashboard trỏ lại. Nếu chỉ "tắt" bằng `system_on=false` (giữ ALB/CloudFront) thì DNS giữ nguyên.

Sau khi trỏ xong: test `https://api.vuduyanh.id.vn/health`, `https://vuduyanh.id.vn`, login + upload Excel end-to-end.

## Phase 9 — Hoàn thiện (sau khi mọi thứ chạy)

- [ ] Remote state: S3 backend (bucket state tạo NGOÀI stack chính, để destroy stack không mất state)
- [ ] Refactor sang modules (`network/`, `database/`, `serverless/`, `api/`, `frontend/`)
- [ ] AWS Budget alert (vd $20/tháng) + CloudWatch alarm 5xx trên ALB
- [ ] CI/CD GitHub Actions (OIDC role): build image → push ECR → `ecs update-service`; build web → s3 sync + invalidation
- [ ] Secrets Manager Lambda Extension thay cho env DATABASE_URL trên Lambda

---

## Thiết kế Bật/Tắt hệ thống 🆕

Hai mức, dùng tùy tình huống:

### Mức 1 — "Ngủ đông" (giữ nguyên hạ tầng, cắt phần tốn tiền theo giờ)

```hcl
variable "system_on" { type = bool, default = true }
```

| `system_on = false` tác động                 | Tiết kiệm                     |
| -------------------------------------------- | ----------------------------- |
| NAT Gateway `count = 0`                      | ~$32/tháng                    |
| ECS Service `desired_count = 0`              | ~$18/tháng (0.5 vCPU)         |
| Aurora hết connection → tự pause sau 10 phút | compute về 0, chỉ còn storage |

Chạy: `terraform apply -var="system_on=false"` (~2 phút). Giữ nguyên: ALB\*, CloudFront, S3, Lambda, Step Functions, ECR, Secrets → **DNS không phải trỏ lại**, bật lên là chạy ngay.

> \*ALB vẫn tốn ~$18/tháng kể cả khi ngủ — nếu muốn tiết kiệm triệt để thì cho ALB vào `count = var.system_on ? 1 : 0` luôn, đổi lại khi bật lại ALB DNS name đổi → phải trỏ lại DNS.

### Mức 2 — "Xóa sạch" (`terraform destroy`)

Mọi thứ trong plan đã được thiết kế để destroy 1 lệnh ăn ngay:

- S3 buckets: `force_destroy = true` (xóa được khi còn file)
- ECR: `force_delete = true`
- Aurora: `skip_final_snapshot = true`
- Secrets Manager: `recovery_window_in_days = 0`
- ACM certs + Cognito: chỉ là `data` lookup → **destroy KHÔNG đụng vào**, an toàn
- CloudFront: destroy hơi lâu (~15–20 phút disable + delete) — bình thường, kiên nhẫn
- ⚠️ Mất data DB + ảnh ECR + file imports; apply lại từ đầu phải: push image, migrate DB, sync FE, trỏ lại DNS

### Tag truy vết (trả lời ý "lỡ không bị xóa thì sau biết tạo từ bao giờ")

Mọi resource đều mang tag `Project=stockflow`, `ManagedBy=terraform`, `CreatedAt=<thời điểm apply đầu>` (Phase 1). Lỡ quên destroy, sau này vào console lọc theo tag `Project=stockflow` là gom được hết đồ của stack này kèm ngày tạo. Image ECR cũng tag theo `YYYYMMDD-hhmmss` (Phase 5).

---

## Quản lý biến môi trường — KHÔNG còn file .env trên cloud 🆕

Nguyên tắc: **Terraform + Secrets Manager là nguồn sự thật duy nhất**, không upload file .env lên S3 rồi kéo về (pattern cũ với bucket `stockflow-configs`).

| Loại biến                                                                                                   | Lưu ở đâu                                                                                                                                                | Vào app bằng cách nào                                                                                         |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Local dev (API/FE)                                                                                          | file `.env` trên máy, gitignore                                                                                                                          | như hiện tại — không đổi gì                                                                                   |
| API runtime, KHÔNG nhạy cảm (`CORS_ORIGIN`, `AWS_S3_BUCKET`, 3 Lambda ARN, Cognito IDs, Pusher key/cluster) | viết trong Terraform — block `environment` của task definition. Phần lớn Terraform TỰ điền vì chính nó tạo ra (bucket name, ARN...) — "tự nối dây"       | ECS inject → `process.env`                                                                                    |
| API runtime, NHẠY CẢM (`DATABASE_URL`, `PUSHER_SECRET`)                                                     | Secrets Manager                                                                                                                                          | ECS `secrets`/`valueFrom` inject lúc container start — không lộ trong task definition, không lộ trong console |
| Lambda env                                                                                                  | giống API: Terraform set trực tiếp trên function                                                                                                         | Lambda runtime                                                                                                |
| FE `NEXT_PUBLIC_*`                                                                                          | KHÁC BIỆT: bake lúc **build**, không phải runtime → script deploy chạy `terraform output` sinh ra `apps/web/.env.production` rồi mới `npm run build:web` | nằm cứng trong JS bundle (vốn public, không phải secret)                                                      |
| Input cho Terraform (Cognito IDs, Pusher keys)                                                              | `terraform.tfvars` local, gitignore                                                                                                                      | `terraform apply` đọc                                                                                         |

Vì sao không dùng S3 chứa file .env: không kiểm soát được ai đổi gì khi nào, app phải tự viết code kéo file, bucket hở là lộ toàn bộ, không rotation. Secrets Manager mã hóa mặc định, phân quyền IAM từng secret, ECS hỗ trợ inject native.

Luồng tổng: `terraform apply` → tạo hạ tầng → tự đổ config vào task def + Lambda env → secret đi đường Secrets Manager → FE build script đọc `terraform output`. Đổi config = sửa Terraform/secret rồi apply + restart service, không sờ file nào trên cloud.

---

## Những điều dễ vấp (đúc kết từ scout codebase)

1. **2 cert ACM, 2 region**: ALB cần cert ở `ap-southeast-1`, CloudFront **bắt buộc us-east-1**. Cert đã validate nhưng phải kiểm tra nó nằm region nào.
2. **Docker build context là root monorepo** (`docker build -f apps/api/Dockerfile .`) — README cũ ghi `./apps/api` là sai với Dockerfile hiện tại.
3. **Health check là `/health`** (không có global prefix trong `main.ts`), container port 3000.
4. **Bỏ AWS access key khỏi env API** — trên Fargate dùng task role.
5. **Aurora không có pgbouncer như Neon** → Lambda giữ `connection_limit=1` trong DATABASE_URL; cần scale lớn mới tính RDS Proxy.
6. **Lambda vào VPC** mới nối được Aurora → role cần `AWSLambdaVPCAccessExecutionRole`; lần destroy ENI của Lambda hơi lâu (~vài phút), bình thường.
7. **SAM stack cũ** phải dọn sau khi Terraform thay thế, tránh 2 EventBridge rule cùng bắn 1 event.
8. **`NEXT_PUBLIC_*` bake lúc build** — đổi API URL là phải rebuild + re-sync FE.
9. **JWT_SECRET là config chết** — code API không dùng (auth 100% Cognito), không cần secret cho nó.
10. **`*.tfvars` vào `.gitignore`** ngay từ Phase 1.
