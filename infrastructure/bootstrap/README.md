# Bootstrap

Stack nhỏ dựng những thứ phải có trước stack chính: bucket chứa Terraform state, OIDC cho GitHub Actions, budget và cảnh báo chi phí bất thường. Chủ dự án apply tay một lần; state của stack này để local (`terraform.tfstate` đã gitignore, **hãy sao lưu file này**).

## Resource tương ứng thao tác trên console

| Terraform                                    | Console                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| `aws_s3_bucket.tfstate` + versioning, mã hoá | S3 → Create bucket → Versioning, Block public access, SSE-S3           |
| `aws_budgets_budget` ×2                      | Billing → Budgets → Create budget (Cost budget, Monthly)               |
| `aws_ce_anomaly_*`                           | Billing → Cost Anomaly Detection → Create monitor + alert subscription |
| `aws_iam_openid_connect_provider.github`     | IAM → Identity providers → Add provider (OpenID Connect)               |
| `aws_iam_role.github_deploy` + `role_policy` | IAM → Roles → Create role → Web identity, gắn inline policy            |

## Các bước

1. Bật **Receive Billing Alerts** (Billing → Billing preferences). Cần cho metric `EstimatedCharges` ở P5.
2. `cp terraform.tfvars.example terraform.tfvars`, điền `alert_email`.
3. `terraform init`
4. Budget $1 đã tạo tay: import để không bị tạo trùng. Lấy account ID bằng `aws sts get-caller-identity`.

   ```bash
   terraform import aws_budgets_budget.early_warning "<account_id>:My Monthly Cost Budget"
   ```

5. `terraform plan`, đọc kỹ, rồi `terraform apply`. Notification của budget cũ sẽ được ghi đè theo code, đó là chủ ý.
6. Xác nhận email đăng ký từ AWS Budgets / Cost Anomaly Detection.
7. Chuyển state stack chính sang S3:

   ```bash
   cd ../terraform
   cp backend.hcl.example backend.hcl   # điền tên bucket từ output tfstate_bucket
   terraform init -migrate-state -backend-config=backend.hcl
   ```

8. Tạo GitHub Environment `production` (Settings → Environments) và thêm required reviewer là chính bạn.

Role `stockflow-github-deploy` chỉ assume được từ job chạy trong environment `production` của repo này.
