# Runbook: deploy tự động

Push lên `main` → job `quality` và `terraform` xanh → job `deploy` chạy (`.github/workflows/quality.yml`). Job `deploy` gắn GitHub Environment `production`.

## Luồng

1. Assume role `stockflow-github-deploy` bằng OIDC. Không có access key nào lưu trong GitHub.
2. Build worker Lambda, Lambda API và migrate Neon bằng `prisma migrate deploy`.
3. `terraform plan`, rồi chặn nếu plan xoá hoặc thay thế `aws_s3_bucket`, `aws_sqs_queue`, `aws_ssm_parameter`, `aws_apigatewayv2_domain_name`, `aws_cloudfront_distribution` (`scripts/check-plan-safety.js`).
4. `terraform apply` đúng plan đã kiểm.
5. Build và sync frontend khi `apps/web` hoặc `packages/shared` đổi, hoặc khi bucket web chưa có `index.html`.
6. Smoke test: `/api/health` phải trả `commitSha` bằng SHA vừa push.

Log của repo public ai cũng đọc được nên job che account ID bằng `::add-mask::` ngay sau khi assume role.

## Secret cần có trong GitHub (Settings → Secrets and variables → Actions)

| Tên                   | Giá trị                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| `AWS_DEPLOY_ROLE_ARN` | ARN của role `stockflow-github-deploy` (output của stack bootstrap)     |
| `NEON_DATABASE_URL`   | Neon pooled URL, có `sslmode=require&pgbouncer=true&connection_limit=1` |
| `NEON_DIRECT_URL`     | Neon direct URL (host không có `-pooler`), dùng cho migrate             |
| `PUSHER_SECRET`       | Tuỳ chọn; để trống thì API bỏ qua realtime                              |

## Chạy tay và rollback

- Chạy lại không cần commit: tab Actions → Quality → Run workflow, chọn `main`.
- Rollback: revert commit trên `main`, pipeline deploy lại bản trước. Lambda không có "image tag cũ" để quay về như ECS nên rollback chính là deploy lại commit cũ.
- Plan bị chặn ở bước an toàn: xem log để biết resource nào bị xoá hoặc thay thế, rồi tự `terraform apply` có chủ đích trên máy chủ dự án.
