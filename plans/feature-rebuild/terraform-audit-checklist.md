# Terraform audit checklist

## Kết luận

Không viết lại Terraform từ đầu.

Repository đã có implementation cho network, database, serverless, ECR, ECS/ALB và frontend. Việc cần làm là audit, chuẩn hóa state/ownership, chạy plan và apply theo từng lớp.

Trạng thái đã kiểm chứng:

- `terraform validate` pass.
- `terraform fmt -check -recursive` chưa pass.
- Code TF-2→TF-7 đã tồn tại trong các file `.tf`.
- Current local state không liệt kê resource.
- Có state backup cũ nhưng không được dùng như bằng chứng hạ tầng đang hoạt động.
- Terraform roadmap checklist chưa cập nhật theo lượng code đã viết.

Bổ sung bối cảnh ngoài repo (Claude, 2026-07-20 — từ lịch sử session Terraform):

- Toàn bộ stack TF-2→TF-8 **đã từng được apply và verify end-to-end ngày 2026-06-15**: frontend live tại `app.vuduyanh.id.vn`, API healthy qua ALB (`/api/health` trả 200, database connected), Aurora đã migrate + seed, login Cognito hoạt động.
- Sau đó chủ dự án chủ động `terraform destroy` (103 resources) để đưa chi phí về ~0. **State hiện tại rỗng là đúng chủ đích, không phải dấu hiệu code chưa chạy được.**
- SAM stack `stockflow-pipeline` đã bị xóa từ 2026-06-13 — Audit 3 chủ yếu còn lại việc xác minh không sót resource tạo tay.
- Runbook tái lập đã có: bật Docker Desktop → `terraform apply` (~20 phút, image rebuild qua local-exec) → `seed-db.ps1` (migrate + seed qua one-off ECS task) → repoint DNS `api.` (ALB mới) và `app.` (CloudFront mới). Cognito, ACM certs sống ngoài Terraform và không bị destroy.
- Gotcha còn tồn tại: orphan CloudFront distro `E2L4RUB4YKMQ6A` chưa xóa được (vướng pricing plan precondition); ALB/CloudFront domain đổi sau mỗi lần recreate nên DNS phải repoint lại.

Do đó ước tính 7–12 ngày cho TF-2→TF-8 là mức thận trọng; tái lập thực tế theo runbook khoảng 1–3 ngày, phần lớn thời gian dành cho audit state/ownership và smoke test.

## Nguyên tắc an toàn

- Không commit hoặc in nội dung `terraform.tfvars`, state hay state backup.
- Không chạy `apply` trước khi đọc toàn bộ plan.
- Không để SAM, Terraform và resource tạo tay cùng sở hữu một logical resource.
- Không xóa stack SAM/bucket/CloudFront cũ chỉ dựa trên tên; phải xác minh dependency và dữ liệu.
- Không dùng `-auto-approve` trong lượt audit đầu.
- Backup/import state đúng cách trước thao tác ownership.

## Audit 1 — Source and format

- [ ] Chạy `terraform fmt -check -recursive`.
- [ ] Chạy `terraform fmt` trong một commit riêng.
- [ ] Chạy `terraform validate`.
- [ ] Kiểm tra `.terraform.lock.hcl` được commit.
- [ ] Kiểm tra provider versions và Node/Lambda runtime còn tương thích.
- [ ] Kiểm tra không có account ID, user pool hoặc domain nhạy cảm bị hardcode sai môi trường.
- [ ] Kiểm tra naming/tagging nhất quán.

## Audit 2 — State

- [ ] Xác định state chính thức: local hay remote.
- [ ] Chạy `terraform state list` trên state chính thức.
- [ ] Không tự chọn state backup làm state chính.
- [ ] So sánh state với AWS resources theo tag `Project=stockflow`.
- [ ] Lập bảng: resource trong code / trong state / trên AWS / owner hiện tại.
- [ ] Quyết định import, recreate hoặc bỏ quản lý cho từng resource lệch.
- [ ] Trước demo lâu dài, chuyển sang remote state + locking theo TF-9.

Mẫu inventory:

| Logical resource    | Terraform address | AWS ID | Current owner        | Action          |
| ------------------- | ----------------- | ------ | -------------------- | --------------- |
| Imports bucket      |                   |        | SAM/Terraform/manual | Import/recreate |
| Step Functions      |                   |        |                      |                 |
| Lambda workers      |                   |        |                      |                 |
| ECS cluster/service |                   |        |                      |                 |
| ALB/target group    |                   |        |                      |                 |
| CloudFront          |                   |        |                      |                 |

## Audit 3 — Ownership migration

- [ ] Liệt kê resource của SAM stack `stockflow-pipeline`.
- [ ] Liệt kê ECS/CloudFront/resource tạo tay cũ.
- [ ] Xác minh bucket có dữ liệu cần giữ không.
- [ ] Xác minh CloudFront alias/domain trước khi delete.
- [ ] Chọn `terraform import` hoặc decommission/recreate.
- [ ] Viết runbook rollback cho mỗi resource stateful.
- [ ] Chỉ xóa stack cũ sau khi resource thay thế đã được xác minh.

## Audit 4 — TF-2 Network

- [ ] VPC CIDR không xung đột.
- [ ] Hai AZ, public/private subnets đúng route.
- [ ] NAT toggle không tạo reference invalid khi `system_on=false`.
- [ ] S3 gateway endpoint hoạt động.
- [ ] Security group tuân theo least privilege.
- [ ] Private subnet vẫn truy cập được AWS APIs cần thiết hoặc có NAT/VPC endpoint.
- [ ] `plan/apply` riêng tầng network và smoke-test.

## Audit 5 — TF-3 Database

- [ ] Aurora engine version hỗ trợ scale-to-zero như cấu hình.
- [ ] Subnet group/private access đúng.
- [ ] Secret không bị output/log.
- [ ] Hiểu rằng secret value vẫn tồn tại trong Terraform state.
- [ ] Lambda/ECS connection strategy không làm cạn connection.
- [ ] Có đường chạy Prisma migration an toàn.
- [ ] Có backup/snapshot policy phù hợp demo.

## Audit 6 — TF-4 Serverless

- [ ] Lambda artifact build reproducible.
- [ ] Architecture/Prisma binaries tương thích ARM64.
- [ ] Lambda trong VPC có network route phù hợp tới AWS services.
- [ ] Step Functions có retry/backoff/catch đúng semantics.
- [ ] S3/EventBridge không tạo duplicate trigger.
- [ ] IAM từng Lambda đúng least privilege.
- [ ] Import task token có timeout/recovery.
- [ ] SAM ownership đã được xử lý trước apply.

## Audit 7 — TF-5/6 API

- [ ] ECR image tag immutable hoặc deployment xác định được digest.
- [ ] Không dùng Terraform `local-exec` như CI production lâu dài.
- [ ] ECS execution role và task role tách đúng.
- [ ] Secret injection đúng.
- [ ] ALB health check khớp `/api/health`.
- [ ] CORS/frontend URL đúng domain.
- [ ] ECS `desired_count=0` khi off nhưng hiểu ALB vẫn có phí.
- [ ] CloudWatch log retention và alarm.

## Audit 8 — TF-7/8 Frontend and DNS

- [ ] S3 private + OAC.
- [ ] CloudFront certificate ở `us-east-1`.
- [ ] API certificate ở region chính.
- [ ] Static export không phụ thuộc middleware/proxy server-side.
- [ ] SPA error routing không che giấu lỗi asset/API.
- [ ] DNS aliases không xung đột distribution cũ.
- [ ] HTTPS smoke test web và API.

## Apply sequence

Không apply toàn bộ stack ngay lần đầu. Dùng thứ tự:

```text
TF-2 Network
→ TF-3 Database + migration
→ TF-4 Serverless ownership migration
→ TF-5 ECR/image
→ TF-6 ECS/ALB
→ TF-7 Frontend
→ TF-8 DNS
→ FR-3 queues/recovery additions
→ FR-4 demo evidence
```

Mỗi bước:

1. `fmt` và `validate`.
2. Tạo saved plan.
3. Review create/change/destroy count.
4. Apply plan đã review.
5. Smoke-test.
6. Ghi output/evidence.
7. Chỉ sau đó chuyển bước tiếp.

## Acceptance criteria

- [ ] Biết chính xác state chính thức nằm ở đâu.
- [ ] Không resource nào có hai owner.
- [ ] TF-2→TF-8 apply theo lớp và có smoke-test.
- [ ] Plan không chứa destroy ngoài dự kiến.
- [ ] README/TERRAFORM_PLAN phản ánh đúng trạng thái “coded”, “applied”, “verified”.
