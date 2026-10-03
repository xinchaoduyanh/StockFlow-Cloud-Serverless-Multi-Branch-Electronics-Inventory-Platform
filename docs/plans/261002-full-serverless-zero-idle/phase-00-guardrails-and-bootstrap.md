# P0 — Guardrails và bootstrap

## Mục tiêu

Dựng ba thứ phải có **trước** mọi lần apply: lưới an toàn chi phí, nơi để Terraform state, và danh tính để GitHub Actions deploy mà không cần access key.

## Vì sao tách thành stack riêng

State bucket và OIDC role không thể nằm trong chính stack mà chúng phục vụ (con gà – quả trứng: stack chính cần state bucket để `init`). Vì vậy tạo một stack nhỏ `infrastructure/bootstrap/`, **chủ dự án apply bằng tay đúng một lần**, state của nó để local (chỉ vài resource, không đổi).

## Thay đổi

### `infrastructure/bootstrap/` (mới)

| Resource                                                 | Ghi chú                                                                                                                                                                                                                    |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aws_budgets_budget` × 2                                 | Ngưỡng $1 (cảnh báo sớm) và $5 (báo động), gửi email. Budget thường không tính phí. Tài khoản **đã có** `My Monthly Cost Budget` $1 tạo tay → `terraform import` nó vào bootstrap thay vì tạo trùng, chỉ tạo mới budget $5 |
| `aws_ce_anomaly_monitor` + `aws_ce_anomaly_subscription` | Phát hiện chi phí bất thường theo dịch vụ, miễn phí                                                                                                                                                                        |
| `aws_s3_bucket` state                                    | Versioning bật, chặn public, mã hoá SSE-S3, `prevent_destroy`                                                                                                                                                              |
| `aws_iam_openid_connect_provider`                        | `token.actions.githubusercontent.com`                                                                                                                                                                                      |
| `aws_iam_role` `stockflow-github-deploy`                 | Trust policy chỉ cho `repo:xinchaoduyanh/StockFlow-…:environment:production`                                                                                                                                               |
| `aws_iam_role_policy`                                    | Quyền đủ để apply stack chính, giới hạn theo prefix tên `stockflow-*` khi có thể                                                                                                                                           |

Email nhận cảnh báo là biến `alert_email`, đặt trong `bootstrap/terraform.tfvars` (đã gitignore).

### `infrastructure/terraform/version.tf`

```hcl
backend "s3" {
  bucket       = "stockflow-tfstate-<account_id>"
  key          = "main/terraform.tfstate"
  region       = "ap-southeast-1"
  use_lockfile = true   # khoá bằng S3 native, không cần DynamoDB (Terraform >= 1.10)
}
```

Nâng `required_version` lên `>= 1.10` cho `use_lockfile`. CI đang dùng 1.15.5 nên không ảnh hưởng.

## Đóng nợ

- OD-02 (state local, không lock)
- OD-14 (không budget alarm) — phần cảnh báo; phần `system_on` không còn ý nghĩa sau P2

## Kiểm chứng

- [ ] `terraform -chdir=infrastructure/bootstrap apply` thành công.
- [ ] Nhận email xác nhận đăng ký từ AWS Budgets.
- [ ] `terraform -chdir=infrastructure/terraform init -migrate-state` đọc được backend S3.
- [ ] Từ một workflow thử (`workflow_dispatch`), `aws sts get-caller-identity` trả về role `stockflow-github-deploy`.

## Chủ dự án tự làm

- Bật **Receive Billing Alerts** trong Billing preferences (để metric `EstimatedCharges` tồn tại, P5 cần).
- Tạo GitHub Environment `production` trong Settings của repo. Repo đang public nên tính năng required reviewers miễn phí.
