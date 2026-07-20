import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AuthorizationPolicyService } from "./authorization-policy.service";

const branchA = "11111111-1111-4111-8111-111111111111";
const branchB = "22222222-2222-4222-8222-222222222222";

describe("AuthorizationPolicyService", () => {
  const policy = new AuthorizationPolicyService();

  it("allows ADMIN to read and adjust any branch", () => {
    const admin = { sub: "admin", role: UserRole.ADMIN, branchId: null };

    expect(() => policy.assertCanReadBranch(admin, branchB)).not.toThrow();
    expect(() => policy.assertCanAdjustInventory(admin, branchB)).not.toThrow();
  });

  it("denies a branch user from reading another branch", () => {
    const manager = { sub: "manager", role: UserRole.STORE_MANAGER, branchId: branchA };

    expect(() => policy.assertCanReadBranch(manager, branchB)).toThrow(ForbiddenException);
    expect(() => policy.assertCanReadBranch(manager, branchA)).not.toThrow();
  });

  it("allows only WAREHOUSE/ADMIN to adjust inventory", () => {
    const manager = { sub: "manager", role: UserRole.STORE_MANAGER, branchId: branchA };
    const warehouse = { sub: "warehouse", role: UserRole.WAREHOUSE, branchId: branchA };

    expect(() => policy.assertCanAdjustInventory(manager, branchA)).toThrow(ForbiddenException);
    expect(() => policy.assertCanAdjustInventory(warehouse, branchA)).not.toThrow();
  });

  it("denies transfer self-approval", () => {
    const warehouse = { sub: "user-1", role: UserRole.WAREHOUSE, branchId: branchA };
    const transfer = { fromBranchId: branchA, requestedBy: "user-1" };

    expect(() => policy.assertCanApproveTransfer(warehouse, transfer)).toThrow(
      "cannot approve their own",
    );
  });

  it("requires ADMIN for recovery operations", () => {
    const warehouse = { sub: "warehouse", role: UserRole.WAREHOUSE, branchId: branchA };

    expect(() => policy.assertAdmin(warehouse)).toThrow("Administrator role is required");
  });

  it("checks branch scope before report ownership on create", () => {
    const manager = { sub: "manager", role: UserRole.STORE_MANAGER, branchId: branchA };

    expect(() => policy.assertCanCreateReport(manager, branchB)).toThrow(
      "not authorized to access this branch",
    );
  });

  it("checks branch scope before report ownership on read", () => {
    const manager = { sub: "manager", role: UserRole.STORE_MANAGER, branchId: branchA };

    expect(() => policy.assertCanReadReport(manager, branchB, "manager")).toThrow(
      "not authorized to access this branch",
    );
  });

  it("rejects branch users without a branch scope for reports", () => {
    const manager = { sub: "manager", role: UserRole.STORE_MANAGER, branchId: null };

    expect(() => policy.assertCanCreateReport(manager, null)).toThrow("branch scope is required");
    expect(() => policy.assertCanReadReport(manager, null, "manager")).toThrow(
      "branch scope is required",
    );
  });
});
