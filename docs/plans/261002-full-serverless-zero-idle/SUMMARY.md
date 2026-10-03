# Implementation Plan: Full Serverless, Zero Idle Cost

> Created: 2026-10-02
> Status: Draft — chờ duyệt
> Thay thế: `docs/plans/260720-1804-neon-natless-terraform/` (giữ Phase 1–2 của plan đó, bỏ Phase 3 công tắc `system_on`)
> Quyết định kiến trúc: [ADR-001](../../adr/ADR-001-full-serverless-zero-idle-cost.md)

## Bối cảnh

Ngân sách AWS của dự án là **0đ**. Kiến trúc hiện tại có 4 thứ tính tiền theo giờ dù không ai dùng: NAT Gateway, ALB, Fargate và public IPv4 (Aurora đã scale-to-zero nhưng là lý do kéo cả hệ thống vào VPC). Vì vậy hệ thống chỉ có thể "dựng thử rồi destroy", và:

- toàn bộ E3 (128 resource) chưa từng chạy thật — OD-17;
- không có demo thường trực — OD-16;
- mỗi lần dựng lại phải chạy tay ~20 phút.

## Mục tiêu

1. **Idle ≈ $0/tháng.** Không còn resource nào tính tiền theo giờ. Demo để chạy thường trực.
2. **Push lên `main` → CI xanh → tự deploy bản mới nhất**, không ai phải chạy `terraform apply` bằng tay nữa.
3. **Mỗi sáng có một email** báo số request, lỗi, độ trễ, DLQ, số job import và chi phí ước tính của ngày hôm trước.
4. **Bộ quan sát đủ các trụ DevOps** (metrics, logs, traces, dashboard, alarm) mà không phải chạy server nào.
5. Chạy E3 thật lần đầu và lưu bằng chứng (đóng OD-17).

## Ngoài phạm vi

- Kubernetes — xem lý do ở [Phase 4](./phase-04-observability.md#vì-sao-không-có-kubernetes).
- Prometheus server / Grafana tự host — xem cùng mục trên.
- Đưa Cognito vào Terraform (OD-03) — giữ user pool hiện có, làm sau.
- Feature nghiệp vụ mới (E5 transfer fulfillment) — làm sau khi plan này xong.
- Di chuyển dữ liệu từ Aurora: không có dữ liệu thật nào để giữ, state hiện có 0 resource.

## Kiến trúc đích

```text
Browser ─► CloudFront + S3 (frontend tĩnh)
        └► API Gateway HTTP API (custom domain api.vuduyanh.id.vn, throttling)
              └► Lambda "api" (NestJS + serverless-express)
                    ├► Neon Postgres (pooled endpoint, TLS)
                    ├► SQS report-jobs ─► Lambda report-exporter ─► S3
                    ├► Step Functions / S3 imports (giữ nguyên E3)
                    └► Pusher, Cognito, SES (gọi thẳng qua internet)

EventBridge Scheduler (07:00 ICT) ─► Lambda "daily-ops-report" ─► SES ─► email của chủ dự án

GitHub Actions: quality ─► deploy (OIDC, không có access key) ─► smoke test
```

Không VPC, không NAT, không ALB, không ECS, không ECR, không Aurora, không Secrets Manager.

## Bản đồ thay đổi theo tầng

Repo giữ nguyên cấu trúc monorepo hiện có — **không thêm app mới**. NestJS lên Lambda chỉ là thêm một entry point trong `apps/api`, không tách thành project riêng.

| Tầng              | Thư mục                             | P0                         | P1                                    | P2                                                              | P3                                                       | P4                          | P5                             |
| ----------------- | ----------------------------------- | -------------------------- | ------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------- | --------------------------- | ------------------------------ |
| Backend           | `apps/api`                          |                            | Prisma `directUrl`, rút binary target | `src/lambda.ts`, health trả SHA, xoá `Dockerfile`               |                                                          | logger JSON, correlation ID |                                |
| Lambda worker     | `apps/lambdas/*` (8 function)       |                            | đọc DB URL từ SSM, Node 22            | log group 14 ngày                                               |                                                          | logger, tracer, metric EMF  | `daily-ops-report` (mới)       |
| Code dùng chung   | `packages/shared`                   |                            | helper đọc SSM                        |                                                                 |                                                          | helper correlation ID       | template `DailyOpsReportEmail` |
| Frontend          | `apps/web`                          |                            |                                       | không đổi code — `NEXT_PUBLIC_API_URL` giữ `api.vuduyanh.id.vn` | build + sync S3 trong pipeline, bỏ `deploy-frontend.ps1` |                             |                                |
| Hạ tầng chính     | `infrastructure/terraform`          | backend S3                 | xoá `network.tf`, sửa `database.tf`   | thêm `api.tf`, xoá `ecs.tf` `alb.tf` `ecr.tf`                   |                                                          | dashboard, alarm            | scheduler, SES identity        |
| Hạ tầng bootstrap | `infrastructure/bootstrap` (mới)    | budget, state bucket, OIDC |                                       |                                                                 |                                                          |                             |                                |
| CI/CD             | `.github/workflows`                 |                            | Node 22                               | thêm `build:api-lambda` vào `quality`                           | job `deploy` (mới)                                       |                             |                                |
| Build             | `esbuild.config.js`, `package.json` |                            | `node22`, bớt engine Prisma           | script `build:api-lambda`                                       |                                                          |                             | thêm entry `daily-ops-report`  |

Frontend là Next.js static export (`output: "export"`) nên vốn đã serverless — chỉ cần đổi **cách deploy** (từ script PowerShell chạy tay sang pipeline), không đổi code.

## Cấu hình và secret nằm ở đâu

| Giá trị                   | Chạy local trên máy dev                                   | Lần apply đầu (tay)                         | Pipeline (P3 trở đi) | Lambda đọc lúc chạy           |
| ------------------------- | --------------------------------------------------------- | ------------------------------------------- | -------------------- | ----------------------------- |
| Neon pooled URL           | không cần                                                 | `infrastructure/terraform/terraform.tfvars` | GitHub secret        | SSM `/stockflow/database-url` |
| Neon direct URL (migrate) | không cần                                                 | `terraform.tfvars` + `seed-db.ps1` đọc      | GitHub secret        | không — chỉ dùng khi migrate  |
| `DATABASE_URL` local      | `apps/api/.env` → Postgres local (Docker), **giữ nguyên** | —                                           | —                    | —                             |
| Pusher secret             | `apps/api/.env`                                           | `terraform.tfvars`                          | GitHub secret        | SSM                           |
| Cognito ID, Pusher key    | `apps/web/.env.local`                                     | biến Terraform (không phải secret)          | biến Terraform       | build-time `NEXT_PUBLIC_*`    |

Cả `*.tfvars` và `.env` đều đã nằm trong `.gitignore`. Dev local tiếp tục dùng Postgres trong Docker như hiện tại (`test:postgres` cũng cần nó) — **Neon chỉ dành cho bản deploy**, để dữ liệu thử ở máy không lẫn vào demo và không tốn dung lượng 0,5 GB của gói free.

## Các phase

| Phase                                        | Nội dung                                                 | Effort     | Phụ thuộc |
| -------------------------------------------- | -------------------------------------------------------- | ---------- | --------- |
| [P0](./phase-00-guardrails-and-bootstrap.md) | Budget alert, remote state, GitHub OIDC role             | 0.5 ngày   | —         |
| [P1](./phase-01-neon-and-remove-vpc.md)      | Neon thay Aurora, xoá VPC/NAT, nâng Node 22              | 1 ngày     | P0        |
| [P2](./phase-02-nestjs-on-lambda.md)         | NestJS lên Lambda + API Gateway, xoá ECS/ALB/ECR         | 1.5–2 ngày | P1        |
| [P3](./phase-03-cicd.md)                     | Pipeline deploy tự động sau CI                           | 1 ngày     | P0, P2    |
| [P4](./phase-04-observability.md)            | Log có cấu trúc, X-Ray, dashboard, alarm                 | 1–1.5 ngày | P2        |
| [P5](./phase-05-daily-ops-report.md)         | Email báo cáo vận hành hằng ngày                         | 0.5–1 ngày | P4        |
| [P6](./phase-06-first-apply-and-evidence.md) | Apply thật, smoke test E3, lưu bằng chứng, cập nhật docs | 1 ngày     | P0–P5     |

Tổng: **khoảng 6–8 ngày công**.

P6 có thể kéo lên chạy ngay sau P3 nếu muốn thấy hệ thống sống sớm; P4–P5 khi đó deploy qua pipeline như mọi thay đổi khác.

## Bảng chi phí dự kiến (ap-southeast-1, lưu lượng demo)

| Dịch vụ                                                             | Cách tính                                    | Ước tính / tháng |
| ------------------------------------------------------------------- | -------------------------------------------- | ---------------- |
| Lambda, API Gateway HTTP API, SQS, Step Functions, EventBridge, SNS | theo request, nằm trong free tier ở mức demo | ~$0              |
| CloudFront + S3                                                     | free tier / vài MB                           | ~$0              |
| CloudWatch                                                          | ≤ 10 alarm, ≤ 3 dashboard, log giữ 14 ngày   | ~$0              |
| SES                                                                 | ~30 email/tháng                              | ~$0              |
| X-Ray                                                               | dưới 100k trace                              | ~$0              |
| SSM Parameter Store (standard)                                      | miễn phí                                     | $0               |
| S3 Terraform state                                                  | vài KB                                       | ~$0              |
| Route 53 hosted zone                                                | chỉ khi DNS nằm trên AWS                     | $0.50            |
| Neon, Pusher, Grafana Cloud (tuỳ chọn)                              | free tier bên ngoài                          | $0               |

Hai chặn an toàn chống "denial of wallet": **API Gateway throttling** và **reserved concurrency** cho Lambda `api` (P2), cộng **Budget alert $1 / $5** (P0).

> Chưa xác nhận: tài khoản AWS đang ở gói Free Tier nào (12 tháng cũ hay gói credit mới). Kiểm tra ở Billing → Free Tier trước P6. Kể cả hết free tier, chi phí ở lưu lượng demo vẫn tính bằng cent.

## Rủi ro chính

| Rủi ro                                       | Hậu quả                                         | Giảm thiểu                                                                                                  |
| -------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| esbuild không hỗ trợ `emitDecoratorMetadata` | NestJS DI hỏng khi chạy — inject ra `undefined` | P2 chốt cách build: `tsc` + prune `node_modules`, hoặc plugin decorator cho esbuild. Có smoke test bắt buộc |
| Cold start NestJS + Neon tự ngủ              | request đầu tiên 2–4 giây                       | Chấp nhận, ghi rõ trong README; lazy-init module nặng; không dùng provisioned concurrency (tốn tiền)        |
| Kết nối Neon cạn                             | lỗi `too many connections` khi Lambda scale     | Dùng pooled endpoint, `connection_limit=1`, reserved concurrency nhỏ                                        |
| Auto-deploy apply nhầm thao tác phá huỷ      | mất bucket/queue/dữ liệu                        | Pipeline chặn nếu plan có `delete` trên resource stateful; GitHub Environment `production`                  |
| Node 20 đã hết hỗ trợ (30/04/2026)           | runtime `nodejs20.x` bị Lambda deprecate        | Nâng lên Node 22 ở P1 cho cả dev, CI và Lambda                                                              |
| SES ở chế độ sandbox                         | chỉ gửi được tới địa chỉ đã verify              | Đủ cho báo cáo gửi chính mình; verify email nhận ở P5                                                       |

## Tiêu chí hoàn thành toàn plan

- [ ] `terraform plan` không còn `aws_nat_gateway`, `aws_lb`, `aws_ecs_*`, `aws_rds_*`, `aws_ecr_*`, `aws_vpc`.
- [ ] Push một commit lên `main` → CI xanh → deploy job xanh → `GET https://api.vuduyanh.id.vn/api/health` trả về commit SHA mới.
- [ ] Nhận được email báo cáo vận hành ít nhất 2 sáng liên tiếp.
- [ ] Dashboard CloudWatch có số liệu thật; ít nhất một trace X-Ray đi qua API → SQS → Lambda.
- [ ] Smoke test E3 có ảnh chụp: message vào DLQ, alarm ở trạng thái ALARM, redrive thành công.
- [ ] Hoá đơn AWS tháng đầu chạy thường trực < $1.
- [ ] README, `docs/debt/`, `infrastructure/TERRAFORM_PLAN.md` khớp với kiến trúc mới.

## Câu hỏi mở — đã trả lời 2026-10-02

1. **Neon:** chủ dự án có project free tier (0,5 GB) ở Singapore. URL **không dán vào chat hay commit** — đặt vào `terraform.tfvars` (gitignore) cho lần apply đầu và GitHub secret cho pipeline.
2. **DNS:** quản lý trên iNET, không có Terraform provider → trỏ CNAME `api.vuduyanh.id.vn` sang domain đích của API Gateway **bằng tay** ở P6. Validation record của ACM cũng thêm tay nếu cần cert mới. Cert `api.` và `app.` hiện đều đang `ISSUED`.
3. **Cognito:** pool `ap-southeast-1_ITWsr9wwd` còn sống (tier Essentials, 6 user CONFIRMED, deletion protection bật, client `stockflow-web` không có secret). Giữ nguyên, OD-03 để sau.
4. **Email báo cáo:** GitHub secret `OPS_REPORT_EMAIL`.

## Hiện trạng tài khoản AWS (quét read-only 2026-10-02)

- Không có NAT, EIP, ALB, RDS, ECS, EC2, ECR, Secrets Manager nào → không có gì đang tính tiền theo giờ.
- Đã có budget `My Monthly Cost Budget` $1, chi tiêu tháng này $0.
- CloudFront `E2L4RUB4YKMQ6A` là site CV ở `vuduyanh.id.vn` (origin `vuduyanh-id-vn-site`), **không thuộc StockFlow — không đụng vào**.
- 2 Lambda cũ không thuộc dự án (`csv-batch-processor`, `etag-filter`), không tốn tiền khi không gọi.
- IAM user dùng cho CLI ở máy dev có `AdministratorAccess` và access key dài hạn → P0 thêm OIDC cho CI; máy dev nên giới hạn lại (xem P0).
