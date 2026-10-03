# Quy tắc làm việc trong repo StockFlow Cloud

Quy tắc cho Claude khi làm việc trên repo này. Chủ dự án là người duy nhất duyệt và apply.

## 1. Bối cảnh bắt buộc phải biết

- Dự án portfolio của một người, mục tiêu là đưa vào CV. Làm việc trực tiếp trên nhánh `main`.
- **Ngân sách AWS bằng 0.** Không đề xuất, không viết Terraform cho bất cứ thứ gì tính tiền theo giờ khi không có traffic: NAT Gateway, ALB/NLB, ECS/Fargate, EC2, RDS/Aurora, EKS, interface VPC endpoint, Secrets Manager, Managed Grafana/Prometheus, WAF. Nếu thật sự cần, phải viết ADR và chờ chủ dự án đồng ý.
- Kiến trúc đích: full serverless. Xem [ADR-001](docs/adr/ADR-001-full-serverless-zero-idle-cost.md).

## 2. Trước khi làm bất cứ việc gì

1. `git fetch origin` và so `git rev-list --left-right --count origin/main...main`. Nếu local đứng sau, đọc `git log main..origin/main` trước khi kết luận gì về hiện trạng — chủ dự án có thể đã push từ máy khác hoặc sửa trên GitHub.
2. Đọc plan đang chạy và sổ nợ:
   - Plan hạ tầng hiện hành: `docs/plans/261002-full-serverless-zero-idle/SUMMARY.md`
   - Plan nghiệp vụ: `plans/feature-rebuild/README.md`
   - Sổ nợ: `docs/debt/README.md`
3. Plan có trạng thái `Superseded` thì không làm theo nữa.

## 3. Nguồn sự thật

| Câu hỏi                    | Xem ở                                            |
| -------------------------- | ------------------------------------------------ |
| Đang làm phase nào, còn gì | `docs/plans/<plan hiện hành>/SUMMARY.md`         |
| Vì sao kiến trúc như vậy   | `docs/adr/`                                      |
| Cái gì đang thiếu hoặc sai | `docs/debt/`                                     |
| Vận hành, sự cố            | `docs/runbooks/`                                 |
| Hạ tầng thật đang có gì    | Terraform state (S3 backend) — không phải README |

Prefix khi nói về phase: `FR-*` (feature rebuild), `TF-*` (Terraform roadmap cũ), `P0`–`P6` kèm tên plan (plan full serverless). Không dùng số phase trần.

## 4. Cấu trúc repo

```text
apps/api            NestJS API — chạy local bằng main.ts, trên AWS bằng src/lambda.ts
apps/lambdas/*      Lambda worker, mỗi thư mục một function, bundle bằng esbuild.config.js
apps/web            Next.js static export → S3 + CloudFront
packages/shared     Type, email template, helper dùng chung
infrastructure/
  bootstrap/        Budget, state bucket, OIDC — chủ dự án apply tay, rất ít khi đổi
  terraform/        Stack chính — chủ sở hữu DUY NHẤT của mọi resource AWS
docs/               plans, adr, debt, runbooks, evidence
plans/feature-rebuild/  Plan nghiệp vụ FR-0 → FR-6
```

Không tạo app hay package mới khi chưa có trong plan.

## 5. Cổng chất lượng

- Trước khi commit: `npm run verify` phải pass (format → lint → typecheck → build → test → build:lambdas).
- Nếu sửa Prisma schema hoặc truy vấn SQL: chạy thêm `npm run test:postgres` (cần Docker).
- Nếu sửa Terraform: `terraform fmt -recursive` và `terraform -chdir=infrastructure/terraform validate`.
- Không tắt rule lint, không thêm `eslint-disable`, không thêm `any` mới để cho qua. Nếu buộc phải làm, ghi lý do ngay tại dòng đó.
- Không chỉnh test cho khớp với bug. Test fail thì sửa code hoặc báo lại.
- Hook `pre-commit` chạy lint-staged; **không dùng `--no-verify`**.

## 6. Code sạch

**Chung**

- Đọc code xung quanh trước khi viết. Code mới phải giống code cũ về cách đặt tên, cấu trúc thư mục và cách xử lý lỗi.
- Tên nói được ý nghĩa: `availableQuantity`, không `qty2`; hàm là động từ (`reserveStock`), boolean bắt đầu bằng `is/has/can`.
- Hàm làm một việc. Hàm dài quá ~40 dòng hoặc lồng quá 3 tầng `if` thì tách ra.
- Return sớm thay vì lồng `if/else` nhiều tầng.
- Không để code chết, code comment-out, `console.log` gỡ lỗi, biến không dùng.
- Không copy-paste logic: lần thứ hai thấy lặp thì cân nhắc, lần thứ ba thì tách hàm. Logic dùng chung giữa API và Lambda đặt ở `packages/shared`.
- Không thêm abstraction, option hay "để sau dùng" khi chưa có chỗ dùng thật.
- Hằng số có ý nghĩa nghiệp vụ đặt tên (`MAX_REPLAY_ATTEMPTS`), không để số trần giữa code.

**Comment**

- Viết đủ, không viết nhiều. Code tự giải thích **cái gì**; comment chỉ giải thích **vì sao** — ràng buộc nghiệp vụ, giới hạn của AWS, lý do chọn cách không hiển nhiên.
- Không comment lặp lại tên hàm hay mô tả từng dòng. Không để comment kiểu nhật ký ("sửa ngày…", "thêm bởi…") — đó là việc của git.
- Comment trong code viết tiếng Anh hoặc tiếng Việt đều được, nhưng trong một file thì thống nhất một thứ tiếng.
- TODO phải kèm mã nợ hoặc phase: `// TODO(TD-14): …`.

**TypeScript**

- `strict` đang bật — giữ nguyên. Không `any`; dùng `unknown` rồi thu hẹp kiểu. Không `as` để ép kiểu cho qua lỗi.
- Kiểu dùng chung giữa API, Lambda và frontend đặt ở `packages/shared`, không khai báo lại.
- Dữ liệu từ ngoài vào (request body, message SQS, event Lambda, file Excel) phải validate trước khi dùng.

**Backend (NestJS, Prisma)**

- Controller mỏng: nhận request, kiểm quyền, gọi service. Logic nghiệp vụ nằm ở service.
- Mọi thay đổi tồn kho đi qua transaction và ghi `StockMovement`. Không cập nhật `Inventory` trực tiếp ở chỗ khác.
- Không nuốt lỗi: `catch` thì phải xử lý, ném lại hoặc log có ngữ cảnh. Lỗi trả cho client dùng exception của NestJS, không trả chuỗi tự chế.
- Truy vấn danh sách phải có phân trang và lọc ở SQL, không lọc trong bộ nhớ.

**Lambda**

- Handler mỏng, logic tách thành hàm thuần để test được không cần AWS.
- Mọi handler phải idempotent — SQS và Step Functions có thể gửi lại cùng một message.
- Khởi tạo client (Prisma, AWS SDK) ngoài handler để tái dùng giữa các lần gọi.

**Frontend (Next.js)**

- Component nhỏ, một trách nhiệm. Code theo tính năng đặt trong `apps/web/src/features/<tính năng>`.
- Gọi API qua `lib/api-client`, không `fetch` rải rác trong component.
- Mọi màn hình có đủ trạng thái loading, rỗng và lỗi.
- Khi làm UI, dùng skill thiết kế trong `.claude/skills/` (xem mục 11).

**Test**

- Sửa bug thì thêm test tái hiện bug đó trước.
- Test đặt tên theo hành vi: `it("rejects transfer when stock is reserved elsewhere")`.

## 7. AWS và Terraform

- **Claude không tự chạy** `terraform apply`, `terraform destroy`, `terraform state rm/mv`, `terraform import`, hay bất kỳ lệnh AWS CLI nào có ghi/xoá (`create-*`, `put-*`, `update-*`, `delete-*`, `s3 rm`, `s3 sync --delete`…). Claude viết code + chạy `validate`/`plan`, giải thích plan, **chủ dự án tự apply**.
- **Mọi lệnh dùng AWS credential phải hỏi chủ dự án trước**, kể cả lệnh chỉ đọc (`describe-*`, `list-*`, `get-*`) và `terraform plan`/`init`/`output`. Nói rõ chạy lệnh gì và để làm gì.
- Không đụng vào resource không thuộc StockFlow trong cùng tài khoản, đặc biệt:
  - CloudFront `E2L4RUB4YKMQ6A` và bucket `vuduyanh-id-vn-site` — site CV cá nhân.
  - Lambda `csv-batch-processor`, `etag-filter`; bucket `do-an-tot-nghiep-ptit`.
- Mọi resource AWS phải nằm trong Terraform. Không tạo tay trên console rồi để đó.
- Mọi resource mới phải có dòng chi phí ước tính trong plan hoặc PR.

## 8. Secret

- Không commit: `.env`, `*.tfvars`, `*.tfstate`, chuỗi kết nối Neon, Pusher secret, access key.
- Không dán secret vào chat với AI, không in secret ra log hay output lệnh.
- Dev local dùng Postgres trong Docker qua `apps/api/.env`. **Neon chỉ dành cho bản deploy.**
- Bản deploy đọc secret từ SSM Parameter Store; giá trị đi vào qua `terraform.tfvars` (máy chủ dự án) hoặc GitHub secret (pipeline).

## 9. Commit và tài liệu

- Conventional Commits: `feat(scope):`, `fix(scope):`, `docs(scope):`, `chore(scope):`, `refactor(scope):`, `test(scope):`. Tiêu đề tiếng Anh, thân commit tiếng Việt, giải thích **vì sao** chứ không liệt kê file.
- Mỗi commit một việc. Không gộp refactor với feature.
- **Hỏi chủ dự án trước mỗi lần push**, kể cả khi đã commit xong. Push lên `main` sẽ kích hoạt CI (và deploy sau P3).
- Chỉ push khi `npm run verify` pass. Không `push --force` lên `main`.
- Tài liệu viết tiếng Việt; tên file, resource, biến, code viết tiếng Anh.
- Làm xong một phase: tick checkbox trong plan, cập nhật `docs/debt/` nếu đóng được nợ, viết `EXECUTION-REPORT.md` trong thư mục plan nếu phase đó có thay đổi hạ tầng.
- Không ghi số hiệu năng hay chi phí lên README/CV khi chưa đo thật. Số đo phải kèm cách tái lập.
- Quyết định kiến trúc mới → ADR mới trong `docs/adr/ADR-NNN-<slug>.md`.

## 10. Cách làm việc với chủ dự án

- Chủ dự án học AWS qua giao diện console. Khi viết Terraform, giải thích từng resource tương ứng với thao tác nào trên console.
- Claude viết code đầy đủ; chủ dự án đọc, chạy `apply` và kiểm tra trên console.
- Câu trả lời và giải thích bằng tiếng Việt.

## 11. Thiết kế UI

Skill thiết kế nằm ở `.claude/skills/`, lấy từ bộ [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) (MIT):

| Skill                                   | Dùng cho                                                                                |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| `redesign-existing-projects`            | **Mặc định cho `apps/web`.** Audit và nâng cấp giao diện đang có, không viết lại từ đầu |
| `taste-skill` (`design-taste-frontend`) | Trang có tính "trình diễn": `/login`, trang giới thiệu dự án, landing page cho CV       |

- Phần lớn `apps/web` là dashboard quản lý kho — chính `taste-skill` tự ghi dashboard, bảng dữ liệu và form nhiều bước nằm **ngoài phạm vi** của nó. Với các màn hình này chỉ lấy phần dùng chung: trạng thái loading/rỗng/lỗi, độ tương phản, dark mode, khoảng cách, typography, không dùng em-dash trong UI.
- Stack giữ nguyên: Next.js + Tailwind v4. **Không cài thêm thư viện UI, icon, animation** (Motion, GSAP, shadcn…) khi chưa hỏi chủ dự án, dù skill có gợi ý.
- Ảnh từ dịch vụ ngoài (picsum, Simple Icons CDN) không dùng trong app thật; chỉ dùng tạm khi làm mockup.
