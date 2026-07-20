import { ForbiddenException, Injectable } from "@nestjs/common";
import { Transfer, UserRole } from "@prisma/client";
export type PolicyActor = {
  id?: string;
  sub?: string;
  role: UserRole;
  branchId: string | null;
};

const BRANCH_ROLES: UserRole[] = [UserRole.STORE_MANAGER, UserRole.WAREHOUSE];
const INVENTORY_WRITERS: UserRole[] = [UserRole.ADMIN, UserRole.WAREHOUSE];
const TRANSFER_APPROVERS: UserRole[] = [UserRole.ADMIN, UserRole.WAREHOUSE];

@Injectable()
export class AuthorizationPolicyService {
  assertAdmin(user: PolicyActor): void {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Administrator role is required");
    }
  }

  assertCanReadBranch(user: PolicyActor, branchId: string): void {
    if (user.role === UserRole.ADMIN) return;
    if (!BRANCH_ROLES.includes(user.role) || user.branchId !== branchId) {
      throw new ForbiddenException("You are not authorized to access this branch");
    }
  }

  assertCanAdjustInventory(user: PolicyActor, branchId: string): void {
    if (!INVENTORY_WRITERS.includes(user.role)) {
      throw new ForbiddenException("Only ADMIN or WAREHOUSE can adjust inventory");
    }
    this.assertCanReadBranch(user, branchId);
  }

  assertCanCreateTransfer(user: PolicyActor, fromBranchId: string, toBranchId: string): void {
    if (![UserRole.ADMIN, ...BRANCH_ROLES].includes(user.role)) {
      throw new ForbiddenException("Your role cannot create transfers");
    }
    if (
      user.role !== UserRole.ADMIN &&
      user.branchId !== fromBranchId &&
      user.branchId !== toBranchId
    ) {
      throw new ForbiddenException("You are not authorized for either transfer branch");
    }
  }

  assertCanReadTransfer(user: PolicyActor, fromBranchId: string, toBranchId: string): void {
    if (user.role === UserRole.ADMIN) return;
    if (user.branchId !== fromBranchId && user.branchId !== toBranchId) {
      throw new ForbiddenException("You are not authorized to access this transfer");
    }
  }

  assertCanApproveTransfer(
    user: PolicyActor,
    transfer: Pick<Transfer, "fromBranchId" | "requestedBy">,
  ): void {
    if (!TRANSFER_APPROVERS.includes(user.role)) {
      throw new ForbiddenException("Only ADMIN or WAREHOUSE can approve transfers");
    }
    this.assertCanReadBranch(user, transfer.fromBranchId);
    if (transfer.requestedBy && transfer.requestedBy === (user.id ?? user.sub)) {
      throw new ForbiddenException("A user cannot approve their own transfer request");
    }
  }

  assertCanConfirmReceipt(user: PolicyActor, toBranchId: string): void {
    if (![UserRole.ADMIN, UserRole.WAREHOUSE, UserRole.STORE_MANAGER].includes(user.role)) {
      throw new ForbiddenException("Your role cannot confirm transfer receipt");
    }
    this.assertCanReadBranch(user, toBranchId);
  }

  assertCanCancelTransfer(
    user: PolicyActor,
    transfer: Pick<Transfer, "fromBranchId" | "requestedBy">,
  ): void {
    if (user.role === UserRole.ADMIN) return;
    this.assertCanReadBranch(user, transfer.fromBranchId);
    if (transfer.requestedBy !== (user.id ?? user.sub)) {
      throw new ForbiddenException(
        "Only the requester or an administrator can cancel this transfer",
      );
    }
  }

  assertCanReadImport(user: PolicyActor, branchId: string): void {
    this.assertCanReadBranch(user, branchId);
  }

  assertCanWriteImport(user: PolicyActor, branchId: string): void {
    if (!INVENTORY_WRITERS.includes(user.role)) {
      throw new ForbiddenException("Only ADMIN or WAREHOUSE can write imports");
    }
    this.assertCanReadBranch(user, branchId);
  }

  assertCanCreateReport(user: PolicyActor, branchId?: string | null): void {
    if (user.role === UserRole.ADMIN) return;
    if (!branchId) {
      throw new ForbiddenException("A branch scope is required to create this report");
    }
    this.assertCanReadBranch(user, branchId);
  }

  assertCanReadReport(
    user: PolicyActor,
    branchId?: string | null,
    createdBy?: string | null,
  ): void {
    if (user.role === UserRole.ADMIN) return;
    if (!branchId) {
      throw new ForbiddenException("A branch scope is required for this report");
    }

    // Branch scope is always checked before ownership. Otherwise a user could
    // read a cross-branch report merely because they happened to create it.
    this.assertCanReadBranch(user, branchId);

    if (createdBy && createdBy === (user.id ?? user.sub)) return;
  }
}
