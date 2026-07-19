# FR-2 — Authorization and quality gates

## Mục tiêu

Chặn truy cập chéo role/chi nhánh tại backend và tạo quality gate tự động.

## 1. Authorization architecture

Tạo lớp policy dùng lại:

```text
AuthorizationPolicyService
- assertCanReadBranch(user, branchId)
- assertCanAdjustInventory(user, branchId)
- assertCanCreateTransfer(user, fromBranchId, toBranchId)
- assertCanApproveTransfer(user, transfer)
- assertCanConfirmReceipt(user, transfer)
- assertAdmin(user)
```

- [ ] Không chỉ dựa vào frontend tab visibility.
- [ ] Controller guard chặn role thô.
- [ ] Service policy chặn ownership/branch scope.
- [ ] Query list tự động scope dữ liệu theo user.
- [ ] Không tin `branchId` từ request nếu user chỉ được gán một branch.
- [ ] Cấm người tạo tự approve transfer.

## 2. Endpoint matrix

| Domain         | Read                                  | Write/trigger                      |
| -------------- | ------------------------------------- | ---------------------------------- |
| Inventory      | ADMIN all; user theo branch           | ADMIN/WAREHOUSE                    |
| Imports        | ADMIN all; user theo branch           | ADMIN/WAREHOUSE hoặc branch policy |
| Transfers      | Các branch liên quan                  | Theo state và separation of duties |
| Reports        | Người tạo hoặc admin; branch scope    | Theo report type và branch         |
| DLQ/recovery   | ADMIN                                 | ADMIN                              |
| Reconciliation | ADMIN; có thể read-only cho WAREHOUSE | ADMIN                              |
| Users/branches | ADMIN                                 | ADMIN                              |

- [ ] Chuyển bảng trên thành automated tests.

## 3. Audit

- [ ] Ghi actor, action, resource, before/after summary, reason và timestamp.
- [ ] Audit các action: adjustment, approve/reject/cancel, replay/discard, resolve reconciliation.
- [ ] Không ghi secret/token/task token vào audit log.

## 4. Code quality

- [ ] Sửa 21 lint errors.
- [ ] Xử lý hoặc cấu hình hợp lý 204 warnings.
- [ ] Thêm ESLint override cho Node CommonJS build scripts thay vì tắt rule toàn repo.
- [ ] Giảm `any` ở boundary types quan trọng.
- [ ] Chuẩn hóa pagination response.

Big-bang refactor dashboard không nằm trong critical path. Chỉ tách phần transfer hoặc serial khi FR-5/FR-6 cần sửa các phần đó.

## 5. Test strategy

- [ ] Unit test policy service.
- [ ] API tests cho role × action × branch.
- [ ] Test user inactive.
- [ ] Test self-approval denial.
- [ ] Test IDOR: truy cập resource bằng ID thuộc branch khác.
- [ ] Test report/download chỉ người hợp lệ truy cập.

PostgreSQL harness đã được dựng ở FR-1; FR-2 chỉ mở rộng nó cho authorization/IDOR tests và đưa vào CI.

## 6. CI

Tạo GitHub Actions với:

- [ ] Install bằng lockfile.
- [ ] Prisma generate.
- [ ] Lint.
- [ ] Unit/integration tests.
- [ ] API/web/shared build.
- [ ] Lambda build.
- [ ] Terraform fmt check.
- [ ] Terraform validate.
- [ ] Dependency/security scan.
- [ ] Cache hợp lý nhưng không cache secret/artifact nhạy cảm.

Không deploy production trong workflow đầu tiên. Deployment được xử lý sau khi FR-3 ổn định.

## Acceptance criteria

- [ ] Không role nào truy cập được branch/resource ngoài policy.
- [ ] Các admin endpoint thực sự yêu cầu ADMIN.
- [ ] Store manager không điều chỉnh kho hoặc tự approve transfer.
- [ ] Lint/test/build/IaC checks pass trong CI.
- [ ] PR có check đỏ khi cố tình làm hỏng một quality gate.
