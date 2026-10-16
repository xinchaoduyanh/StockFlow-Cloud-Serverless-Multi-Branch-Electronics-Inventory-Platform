# Implementation Plan: Full Serverless, Zero Idle Cost

> Created: 2026-10-02
> Status: Draft — chờ duyệt
> Thay thế: `docs/plans/260720-1804-neon-natless-terraform/` (giữ Phase 1–2 của plan đó, bỏ Phase 3 công tắc `system_on`)
> Quyết định kiến trúc: [ADR-001](../../adr/ADR-001-full-serverless-zero-idle-cost.md)

## Tiến độ (cập nhật 2026-10-15)

| Phase | Trạng thái                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------- |
| P0–P3 | Xong, đã kiểm chứng trên AWS                                                                                                    |
| P4    | Đã deploy. API đọc DB thật qua Neon, alarm 5xx → email đã kiểm chứng (2026-10-16). **Còn 2 ô chưa kiểm** (X-Ray, Logs Insights) |
| P5    | Đã deploy. Email báo cáo tự đến lúc 07:00 ngày 2026-10-15 (mới 1 sáng; cần sáng 16/10 để đủ 2 sáng liền)                        |
| P6    | Chưa làm (đã có runbook `rebuild-from-zero` và checklist bằng chứng)                                                            |

## Bàn giao 2026-10-15 (làm tiếp ở máy khác)

**Đã xong trong ngày:** sửa lỗi `PrismaClient` tạo trước khi SSM trả URL (`6552596`), email báo cáo giờ ghi "Cần xem" khi worker lỗi (`2a3503e`), đã duyệt toàn bộ 9 màn hình dashboard bằng tài khoản admin thật (không lỗi console, không lỗi log API), pipeline nhận biến repo `ENABLE_DEBUG_ENDPOINT` (`6d4a8cb`).

**Thử alarm 5xx (bước B của P4): đã xong 2026-10-16, còn phải TẮT endpoint.** Pipeline #24 (`26b6ffa`) đã deploy với biến repo `ENABLE_DEBUG_ENDPOINT=true`; **sáng 2026-10-16 `GET /api/debug/fail` đang trả 500, tức endpoint đang BẬT** và alarm chưa được thử. Việc cần làm khi ngồi lại:

1. Kiểm tra Lambda `api` có `DEBUG_ENDPOINTS_ENABLED=true` và `GET /api/debug/fail` trả 500 (trước đó trả 404).
2. Gọi endpoint khoảng 8 lần trong 5 phút. Alarm `stockflow-api-5xx` cần hơn 5 lỗi 5xx trong 5 phút mới chuyển ALARM. Xác nhận email SNS (xem cả thư rác), chụp ảnh vào `docs/evidence/261002-first-apply/` (che account ID).
3. **Bắt buộc tắt lại (chưa làm lúc ghi dòng này):** xoá biến repo `ENABLE_DEBUG_ENDPOINT` (hoặc đặt `false`), chạy lại Deploy, rồi xác nhận endpoint trả 404. Để endpoint bật là mở sẵn một đường ép lỗi 5xx cho người lạ.
4. Biến này từng bị tạo nhầm thành **secret** trùng tên; secret đó cần xoá. Workflow chỉ đọc `vars.`.

**Còn lại của P4/P5:** X-Ray service map và Logs Insights theo `correlationId` cần một lần import và một lần xuất báo cáo thật (E3 chưa chạy trên AWS). Email báo cáo cần thêm sáng 2026-10-16 để đủ "2 sáng liền". Một lần email vào thư rác: bấm "không phải thư rác".

**Bảo mật:**

- Mật khẩu 6 user Cognito test (dùng chung) lưu ở file `matkhaustockflow` trong `~/Documents/working/` (ngoài repo, không commit). Mật khẩu từng hiện trong chat với AI nên **đổi lại** sau khi test xong bằng `admin-set-user-password --permanent` chạy ở terminal của chủ dự án.
- Lệnh gửi qua ô `!` của app Claude chạy ở Terminal 1 và kết quả hiện cho AI: không in secret ở đó.

**Phát hiện khi duyệt UI (đã ghi vào `docs/debt/`: TD-16, TD-17, TD-18, OD-19):**

- Trang login không có "Quên mật khẩu"; user ở trạng thái "Reset required" không đăng nhập lại được từ UI.
- `consumer.apply(...).forRoutes("*")` ở `apps/api/src/app.module.ts` gây WARN `Unsupported route path "/api/*"` mỗi cold start (path-to-regexp mới cần `*path`).
- Cảnh báo tồn thấp liệt kê một dòng có số lượng 12, tối thiểu 8, thiếu hụt 0: cần đọc điều kiện lọc.
- 2 nhân viên email `@stockflow.local` có trong DB nhưng không có trong Cognito.
- Dữ liệu trong Neon là dữ liệu cũ (tháng 5–6/2026); import, báo cáo và Step Functions chưa chạy lại sau khi sang serverless (OD-17, P6).

Việc treo xuyên phase (làm trên máy nào cũng được):

- **Đã sửa 2026-10-15:** 9 Lambda worker không bao giờ truy cập được DB vì tạo `PrismaClient` ở mức module, trước khi SSM trả `DATABASE_URL` nên engine Prisma chụp env khi chưa có URL. Lỗi lộ ra nhờ email báo cáo ngày (`import-recovery-worker` lỗi 288 lần) trong khi `/api/health` vẫn xanh vì không chạm DB. Sửa ở `6552596`, worker `import-recovery-worker` đã chạy thành công trên AWS. Chưa kiểm: 8 worker còn lại và API (API đã đúng thứ tự từ code, nhưng chưa có request nào chạm DB thật). Smoke test ở P3/P6 phải có một endpoint đọc DB, không chỉ `/api/health`.
- Reset mật khẩu Neon (từng lộ trong chat) rồi cập nhật `terraform.tfvars` và 2 GitHub secret `NEON_DATABASE_URL`, `NEON_DIRECT_URL`.
- `PUSHER_SECRET` vẫn nằm trong biến môi trường Lambda `api`, nên chuyển sang SSM.
- P3 còn 2 ô chưa kiểm: chốt an toàn chặn đổi tên bucket; ghi thời gian push→deploy vào README kèm cách tái lập.
- Reserved concurrency của Lambda `api` không đặt được (hạn mức tài khoản 10); chặn chi phí bằng throttling API Gateway (20 rps, burst 40).
- Chưa thử đầu cuối: đăng nhập Cognito, import file, report, 8 worker, Step Functions (thuộc P6).

Máy mới: xem `docs/runbooks/new-machine-setup.md`; deploy: `docs/runbooks/deploy.md`; quan sát: `docs/runbooks/observability.md`.

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
- Tài khoản có resource của dự án khác, trong đó có site CV cá nhân ở domain gốc — **không thuộc StockFlow, không đụng vào**. Chỉ làm việc với resource có tag `Project = stockflow`.
- CLI trên máy dev đang dùng access key dài hạn → P0 thêm OIDC cho CI để pipeline không cần key; key trên máy nên được giới hạn quyền và rotate định kỳ.
