# P3 — Push là tự deploy

## Mục tiêu

Push lên `main` → `quality` xanh → tự deploy bản mới nhất lên AWS → smoke test. Không còn chạy `terraform apply` hay `deploy-frontend.ps1` bằng tay.

## Luồng

```text
push main
  └► quality.yml (đã có): format → lint → typecheck → build → test → test:postgres → build:lambdas → audit
        └► deploy.yml (mới), chỉ chạy khi quality xanh và nhánh là main
              1. Lấy credential bằng OIDC (role từ P0) — không lưu access key nào trong GitHub
              2. Build: lambdas worker + Lambda api + frontend
              3. prisma migrate deploy  (DIRECT_URL từ GitHub secret)
              4. terraform plan -out=tfplan
              5. Chốt an toàn: chặn nếu plan xoá resource stateful
              6. terraform apply tfplan
              7. Frontend: s3 sync + CloudFront invalidation
              8. Smoke test: GET /api/health phải trả commitSha == GITHUB_SHA
```

Trigger: `workflow_run` của `Quality` với `conclusion == success` trên `main`, hoặc gộp thành job thứ hai trong `quality.yml` với `needs: [quality, terraform]`. Chọn **gộp job** — đơn giản hơn và giữ đúng commit SHA.

## Quyết định thiết kế

**Terraform vẫn là chủ duy nhất của code Lambda.** Không dùng `aws lambda update-function-code` trong pipeline, vì làm thế Terraform sẽ thấy drift và lần apply sau đè lại bản cũ. Cơ chế hiện có (S3 key theo md5 của zip, xem `serverless.tf:92`) đã đủ để mỗi lần code đổi thì Lambda nhận bản mới.

**Chốt an toàn ở bước 5.** Đọc `terraform show -json tfplan`, fail nếu có action `delete` hoặc `replace` trên các type sau: `aws_s3_bucket`, `aws_sqs_queue`, `aws_ssm_parameter`, `aws_apigatewayv2_domain_name`, `aws_cloudfront_distribution`. Muốn thay đổi những thứ này thì chạy tay có chủ đích. Đây là điểm đáng kể khi phỏng vấn: auto-deploy nhưng có policy chặn phá huỷ.

**GitHub Environment `production`.** Job deploy gắn `environment: production`. Mặc định không bật required reviewer để giữ đúng yêu cầu "push là deploy"; khi cần có thể bật mà không sửa workflow.

**Concurrency.** `group: deploy-production`, `cancel-in-progress: false` — không bao giờ huỷ giữa chừng một lần apply.

**Frontend deploy thay `deploy-frontend.ps1`.** Script hiện tại hardcode Cognito ID và để trống Pusher key. Pipeline sinh `apps/web/.env.production` từ `terraform output` (API URL, Cognito pool/client ID, Pusher key/cluster — đều không phải secret), rồi `npm run build:web` → `aws s3 sync apps/web/out --delete` → CloudFront invalidation. Xoá `deploy-frontend.ps1` khi pipeline chạy ổn. Chỉ build và sync frontend khi `apps/web/**` hoặc `packages/shared/**` đổi, để không invalidate CloudFront vô ích.

**Migration chạy trước apply.** Migration Prisma phải tương thích ngược (expand → contract) để bản code cũ vẫn chạy được trong vài giây trước khi Lambda nhận bản mới. Ghi quy ước này vào `CONTRIBUTING` hoặc ADR.

## Secrets trong GitHub

| Tên                   | Dùng cho                                                          |
| --------------------- | ----------------------------------------------------------------- |
| `AWS_DEPLOY_ROLE_ARN` | OIDC assume role (không phải secret thật, nhưng để chung cho gọn) |
| `NEON_DATABASE_URL`   | `TF_VAR_neon_database_url`                                        |
| `NEON_DIRECT_URL`     | migration + `TF_VAR_neon_direct_url`                              |
| `PUSHER_SECRET`       | `TF_VAR_pusher_secret`                                            |
| `OPS_REPORT_EMAIL`    | `TF_VAR_ops_report_email` (P5)                                    |

Không còn `terraform.tfvars` chứa secret trên máy dev bắt buộc cho deploy.

## Rollback

Revert commit trên `main` → pipeline deploy lại bản trước. Ghi rõ trong runbook: Lambda không có "image tag cũ" để quay về như ECS, rollback chính là deploy lại commit cũ.

## Kiểm chứng

- [ ] Một commit chỉ sửa text trong `/api/health` được deploy tự động, smoke test thấy SHA mới.
- [ ] Một commit cố tình đổi tên bucket bị pipeline chặn ở bước 5.
- [ ] Workflow không chứa `AWS_ACCESS_KEY_ID` ở bất cứ đâu.
- [ ] Thời gian từ push tới deploy xong được ghi lại vào README.
