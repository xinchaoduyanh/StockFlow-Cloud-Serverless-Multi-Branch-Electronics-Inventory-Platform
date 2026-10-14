# Runbook: dựng lại toàn bộ hệ thống từ trắng

Dùng khi tài khoản AWS trống (hoặc đã destroy stack chính) và cần đưa StockFlow lên lại. Tài liệu không chứa secret hay account ID; các giá trị đó bạn tự lấy theo từng bước. Idle cost của kiến trúc đích là xấp xỉ $0, nên dựng lên rồi để chạy được.

> Dành cho Claude: không tự chạy `terraform apply` hay lệnh AWS ghi/xoá; hỏi chủ dự án trước mọi lệnh dùng AWS credential.

## 0. Điều kiện

- Đã làm xong [new-machine-setup](./new-machine-setup.md): có Node 22, Terraform `>= 1.10`, AWS CLI, `npm ci`.
- Neon project ở `ap-southeast-1` có sẵn pooled URL và direct URL.
- Docker không bắt buộc (chỉ cần cho `npm run test:postgres`).

## 1. Bootstrap (chỉ khi tài khoản chưa có state bucket)

Xem `infrastructure/bootstrap/README.md`. Stack này tạo budget alert, bucket state S3 và role OIDC cho GitHub. Apply tay, rất ít khi đổi. Ghi lại output `tfstate_bucket` và ARN role deploy.

## 2. Chuẩn bị file cục bộ

| File                                        | Nội dung                                                                                      |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `infrastructure/terraform/backend.hcl`      | từ `backend.hcl.example`, điền `tfstate_bucket`                                               |
| `infrastructure/terraform/terraform.tfvars` | `neon_database_url`, `neon_direct_url`, `ops_alert_email`, tuỳ chọn Pusher. Không commit file |

## 3. Build artifact

```bash
npm ci
```

```bash
npm run build
```

```bash
npm run build:lambdas
```

```bash
npm run build:api-lambda
```

Terraform đóng gói từ `dist/`, nên bước này phải chạy trước `plan`.

## 4. Apply lần đầu (chủ dự án chạy tay)

```bash
terraform -chdir=infrastructure/terraform init -backend-config=backend.hcl
```

```bash
terraform -chdir=infrastructure/terraform plan -out=first-apply.plan
```

Đọc plan: không được có `aws_nat_gateway`, `aws_lb`, `aws_ecs_*`, `aws_rds_*`, `aws_vpc`. Sau đó:

```bash
terraform -chdir=infrastructure/terraform apply first-apply.plan
```

## 5. Xác minh email (hai email từ AWS)

1. **SNS subscription** (`stockflow-ops-alerts`): Terraform tạo, AWS gửi email; bấm **Confirm subscription**. Chưa bấm thì không nhận alarm.
2. **SES identity** cho `ops_alert_email`: Terraform **không** tạo identity này vì nó có thể dùng chung với dự án khác trong tài khoản. Nếu SES → Identities chưa có địa chỉ này ở trạng thái `Verified`, tạo tay ở console (Create identity → Email address) rồi bấm link xác minh. Chưa xác minh thì Lambda `daily-ops-report` không gửi được email (SES sandbox).

## 6. Migrate và seed Neon

```bash
export DIRECT_URL='<neon direct url>'
```

```bash
infrastructure/terraform/seed-db.sh
```

Seed tạo 3 chi nhánh và 3 tài khoản cho 3 role. Không dán URL vào chat hay commit.

## 7. DNS (iNET, thêm tay)

- `api.vuduyanh.id.vn`: CNAME tới domain đích của API Gateway (output Terraform `api_domain_target`).
- `app.vuduyanh.id.vn`: CNAME tới domain CloudFront (output `cloudfront_domain`).
- Cert ACM `api.` và `app.` đang `ISSUED`; chỉ thêm record validation khi phải xin cert mới.

## 8. Kiểm tra sau khi dựng

```bash
curl https://api.vuduyanh.id.vn/api/health
```

Phải trả `status: ok`, `database: connected` và `commitSha` đúng bản vừa deploy. Từ đây mọi thay đổi đi qua pipeline (push `main` → CI → deploy, xem [deploy.md](./deploy.md)).

Gửi thử báo cáo vận hành ngay, không chờ 07:00:

```bash
aws lambda invoke --function-name stockflow-daily-ops-report --cli-binary-format raw-in-base64-out --payload '{}' /dev/null
```

Lệnh này dùng AWS credential nên chủ dự án tự chạy. Email về trong vài giây; tiêu đề báo trạng thái (Ổn / Cần xem / Có sự cố).

## 9. Smoke test E3 và lưu bằng chứng

Làm theo [e3-recovery.md](./e3-recovery.md) và [observability.md](./observability.md), lưu kết quả vào `docs/evidence/261002-first-apply/` theo checklist trong thư mục đó.

## Gỡ bỏ

`terraform destroy` chỉ chạy có chủ đích trên máy chủ dự án. Bucket có `force_destroy = true` nên dữ liệu trong bucket mất theo. Không destroy stack bootstrap trừ khi bỏ hẳn dự án.
