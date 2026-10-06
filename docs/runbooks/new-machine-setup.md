# Dựng môi trường làm việc trên máy mới

Dành cho chủ dự án, và để Claude trên máy mới đọc rồi hướng dẫn từng bước. Tài liệu này **không chứa secret hay account ID**; những giá trị đó bạn tự lấy theo từng bước.

> Dành cho Claude: đọc `CLAUDE.md` trước, rồi làm theo tài liệu này. Không tự chạy lệnh AWS ghi/xoá, `terraform apply`, hay push. Hỏi chủ dự án trước mọi lệnh dùng AWS credential. Không in secret ra output.

## 1. Cài công cụ

| Công cụ        | Ghi chú                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------- |
| Git            | Cấu hình `user.name` và `user.email` như máy cũ                                                   |
| Node.js        | Plan full serverless nâng lên Node 22 ở P1; hiện `package.json` yêu cầu `>=20.11.0`. Dùng Node 22 |
| Docker Desktop | Chạy Postgres local và `npm run test:postgres`                                                    |
| Terraform      | `>= 1.10` (cần cho `use_lockfile`)                                                                |
| AWS CLI v2     | Chỉ cần khi chạy Terraform hoặc lệnh AWS                                                          |

## 2. Lấy code

```bash
git clone https://github.com/xinchaoduyanh/StockFlow-Cloud-Serverless-Multi-Branch-Electronics-Inventory-Platform.git
```

```bash
cd StockFlow-Cloud-Serverless-Multi-Branch-Electronics-Inventory-Platform
```

```bash
npm ci
```

Sau khi cài, hook husky tự được dựng lại. Luôn chạy `git fetch origin` đầu mỗi phiên (Codex cũng có thể đã đẩy commit).

## 3. File không nằm trong git: tự tạo lại

| File                                         | Tạo từ                     | Chứa                                                         | Cần khi                     |
| -------------------------------------------- | -------------------------- | ------------------------------------------------------------ | --------------------------- |
| `apps/api/.env`                              | `apps/api/.env.example`    | `DATABASE_URL` Postgres local, `JWT_SECRET`, Cognito, Pusher | Chạy API local              |
| `apps/web/.env.local`                        | `apps/web/.env.example`    | `NEXT_PUBLIC_*` (Cognito, URL API). Không phải secret        | Chạy web local              |
| `infrastructure/terraform/terraform.tfvars`  | tự gõ                      | URL Neon, Pusher secret                                      | Chỉ khi apply stack chính   |
| `infrastructure/terraform/backend.hcl`       | `backend.hcl.example`      | Tên bucket state                                             | Chạy terraform stack chính  |
| `infrastructure/bootstrap/terraform.tfvars`  | `terraform.tfvars.example` | Email cảnh báo, ARN anomaly monitor                          | Chỉ khi apply lại bootstrap |
| `infrastructure/bootstrap/terraform.tfstate` | **copy từ máy cũ**         | State của bootstrap                                          | Chỉ khi sửa bootstrap       |

Dev local chỉ cần Docker và `.env`, **không cần AWS**. Local dùng Postgres trong Docker; Neon chỉ dành cho bản deploy.

Khoá lấy ở đâu:

- `JWT_SECRET` và mật khẩu Postgres local: tự đặt, chỉ dùng trên máy bạn.
- Cognito ID: Console → Cognito → User pools → app client. Pool đang dùng được ghi trong plan.
- URL Neon: Neon console → Connection details (dùng bản pooled). **Không dán vào chat với AI.**

## 4. Credential AWS

```bash
aws configure
```

Nhập access key của IAM user dùng cho dự án và region `ap-southeast-1`. Kiểm tra:

```bash
aws sts get-caller-identity
```

Đừng dán output vào chat hay docs vì có account ID. Về lâu dài, key trên máy nên giới hạn quyền và rotate định kỳ (xem plan P0).

## 5. Stack Terraform

Stack chính dùng state trên S3, nên máy nào có credential và `backend.hcl` cũng dùng được:

```bash
cp infrastructure/terraform/backend.hcl.example infrastructure/terraform/backend.hcl
```

Điền tên bucket (dạng `stockflow-tfstate-<account_id>`; lấy từ `terraform output tfstate_bucket` của bootstrap hoặc từ S3 console), rồi:

```bash
terraform -chdir=infrastructure/terraform init -backend-config=backend.hcl
```

Stack bootstrap có state local. Nếu cần sửa nó trên máy mới, **phải copy `terraform.tfstate` từ máy cũ trước**, nếu không Terraform sẽ coi mọi thứ là chưa tồn tại và cố tạo lại (lỗi trùng tên bucket, role). Không import lại trừ khi mất file state.

## 6. Kiểm tra máy mới đã sẵn sàng

```bash
npm run verify
```

Nếu sửa Prisma schema hoặc SQL, chạy thêm:

```bash
npm run test:postgres
```

## 7. Mang gì từ máy cũ (checklist)

- [ ] `infrastructure/bootstrap/terraform.tfstate` (quan trọng nhất)
- [ ] Giá trị trong các file `.env`, `terraform.tfvars` (hoặc tự lấy lại theo bảng ở mục 3)
- [ ] Access key AWS, hoặc tạo key mới cho máy mới
- [ ] Không cần mang `node_modules`, `.next`, `.terraform/`, `builds/` (tạo lại được)

Truyền file qua USB hoặc kho lưu trữ riêng tư. **Không gửi qua chat, email hay commit.**
