import {
  StockMovementReferenceType,
  CreateTransferBody,
  RejectTransferBody,
  TransferListQuery,
  TransferDTO,
} from "@stockflow/shared";
import { Injectable } from "@nestjs/common";
import { StockMovementType, TransferStatus } from "@prisma/client";
import { ApiErrors } from "../common/errors/api-error";
import { toPagination } from "../common/schemas/pagination.schema";
import { PrismaService } from "../database/prisma.service";
import { AuthorizationPolicyService, PolicyActor } from "../auth/authorization-policy.service";

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization?: AuthorizationPolicyService,
  ) {}

  async list(query: TransferListQuery, actor?: PolicyActor): Promise<TransferDTO[]> {
    const { skip, take } = toPagination(query);
    const branchId = this.scopeBranchId(query.branchId, actor);

    const transfers = await this.prisma.transfer.findMany({
      skip,
      take,
      where: branchId
        ? {
            OR: [{ fromBranchId: branchId }, { toBranchId: branchId }],
          }
        : {},
      include: {
        fromBranch: true,
        toBranch: true,
        items: { include: { component: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const userIds = Array.from(
      new Set(
        transfers
          .flatMap((t) => [t.requestedBy, t.approvedBy, t.rejectedBy])
          .filter(Boolean) as string[],
      ),
    );

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        fullName: true,
        role: true,
        branch: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return transfers.map((t) => ({
      ...t,
      requestedByUser: t.requestedBy ? userMap.get(t.requestedBy) : null,
      approvedByUser: t.approvedBy ? userMap.get(t.approvedBy) : null,
      rejectedByUser: t.rejectedBy ? userMap.get(t.rejectedBy) : null,
    })) as any;
  }

  async get(id: string, actor?: PolicyActor): Promise<TransferDTO> {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id },
      include: {
        fromBranch: true,
        toBranch: true,
        items: { include: { component: true } },
      },
    });

    if (!transfer) {
      throw ApiErrors.notFound("Transfer not found");
    }
    if (actor)
      this.authorization?.assertCanReadTransfer(actor, transfer.fromBranchId, transfer.toBranchId);

    const userIds = [transfer.requestedBy, transfer.approvedBy, transfer.rejectedBy].filter(
      Boolean,
    ) as string[];

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        fullName: true,
        role: true,
        branch: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      ...transfer,
      requestedByUser: transfer.requestedBy ? userMap.get(transfer.requestedBy) : null,
      approvedByUser: transfer.approvedBy ? userMap.get(transfer.approvedBy) : null,
      rejectedByUser: transfer.rejectedBy ? userMap.get(transfer.rejectedBy) : null,
    } as any;
  }

  async create(input: CreateTransferBody, actor?: PolicyActor): Promise<TransferDTO> {
    if (actor)
      this.authorization?.assertCanCreateTransfer(actor, input.fromBranchId, input.toBranchId);
    const actorId = actor?.sub ?? actor?.id;
    return this.prisma.$transaction(async (tx) => {
      const itemsByLockOrder = [...input.items].sort((left, right) =>
        left.componentId.localeCompare(right.componentId),
      );

      for (const item of itemsByLockOrder) {
        // The stock check and reservation must be one database operation. A read followed by
        // an increment allows two concurrent transfers to observe the same available quantity.
        const reserved = await tx.$executeRaw`
          UPDATE "inventory"
          SET
            "reserved_quantity" = "reserved_quantity" + ${item.quantity},
            "version" = "version" + 1,
            "updated_at" = CURRENT_TIMESTAMP
          WHERE "branch_id" = ${input.fromBranchId}::uuid
            AND "component_id" = ${item.componentId}::uuid
            AND "quantity" - "reserved_quantity" >= ${item.quantity}
        `;

        if (reserved !== 1) {
          const inventory = await tx.inventory.findUnique({
            where: {
              branchId_componentId: {
                branchId: input.fromBranchId,
                componentId: item.componentId,
              },
            },
          });
          const available = (inventory?.quantity ?? 0) - (inventory?.reservedQuantity ?? 0);

          throw ApiErrors.badRequest("Insufficient available stock", {
            componentId: item.componentId,
            available,
            requested: item.quantity,
          });
        }
      }

      const transfer = await tx.transfer.create({
        data: {
          fromBranchId: input.fromBranchId,
          toBranchId: input.toBranchId,
          status: TransferStatus.PENDING,
          requestedBy: actorId,
          note: input.note,
          items: {
            create: input.items.map((item) => ({
              componentId: item.componentId,
              quantity: item.quantity,
            })),
          },
        },
        include: {
          fromBranch: true,
          toBranch: true,
          items: { include: { component: true } },
        },
      });

      await tx.stockMovement.createMany({
        data: input.items.map((item) => ({
          branchId: input.fromBranchId,
          componentId: item.componentId,
          movementType: StockMovementType.RESERVATION_CREATED,
          quantityChange: item.quantity,
          referenceType: StockMovementReferenceType.TRANSFER,
          referenceId: transfer.id,
          createdBy: actorId,
        })),
      });

      return transfer;
    }) as any;
  }

  async approve(id: string, actor?: PolicyActor): Promise<TransferDTO> {
    const actorId = actor?.sub ?? actor?.id;
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!transfer) {
        throw ApiErrors.notFound("Transfer not found");
      }
      if (actor) this.authorization?.assertCanApproveTransfer(actor, transfer);

      if (transfer.status !== TransferStatus.PENDING) {
        throw ApiErrors.conflict("Only pending transfers can be approved");
      }

      for (const item of transfer.items) {
        const source = await tx.inventory.findUnique({
          where: {
            branchId_componentId: {
              branchId: transfer.fromBranchId,
              componentId: item.componentId,
            },
          },
        });

        if (!source || source.reservedQuantity < item.quantity || source.quantity < item.quantity) {
          throw ApiErrors.conflict("Reserved source stock is no longer sufficient", {
            componentId: item.componentId,
          });
        }

        await tx.inventory.update({
          where: {
            branchId_componentId: {
              branchId: transfer.fromBranchId,
              componentId: item.componentId,
            },
          },
          data: {
            quantity: { decrement: item.quantity },
            reservedQuantity: { decrement: item.quantity },
            version: { increment: 1 },
          },
        });

        await tx.inventory.upsert({
          where: {
            branchId_componentId: {
              branchId: transfer.toBranchId,
              componentId: item.componentId,
            },
          },
          update: {
            quantity: { increment: item.quantity },
            version: { increment: 1 },
          },
          create: {
            branchId: transfer.toBranchId,
            componentId: item.componentId,
            quantity: item.quantity,
          },
        });

        await tx.stockMovement.createMany({
          data: [
            {
              branchId: transfer.fromBranchId,
              componentId: item.componentId,
              movementType: StockMovementType.TRANSFER_OUT,
              quantityChange: -item.quantity,
              referenceType: StockMovementReferenceType.TRANSFER,
              referenceId: transfer.id,
              createdBy: actorId,
            },
            {
              branchId: transfer.toBranchId,
              componentId: item.componentId,
              movementType: StockMovementType.TRANSFER_IN,
              quantityChange: item.quantity,
              referenceType: StockMovementReferenceType.TRANSFER,
              referenceId: transfer.id,
              createdBy: actorId,
            },
          ],
        });
      }

      return tx.transfer.update({
        where: { id },
        data: {
          status: TransferStatus.COMPLETED,
          approvedBy: actorId,
          approvedAt: new Date(),
          completedAt: new Date(),
        },
        include: {
          fromBranch: true,
          toBranch: true,
          items: { include: { component: true } },
        },
      }) as any;
    });
  }

  async reject(id: string, input: RejectTransferBody, actor?: PolicyActor): Promise<TransferDTO> {
    return this.releaseReservation(id, TransferStatus.REJECTED, actor, input.reason);
  }

  async cancel(id: string, actor?: PolicyActor): Promise<TransferDTO> {
    return this.releaseReservation(id, TransferStatus.CANCELLED, actor);
  }

  private async releaseReservation(
    id: string,
    nextStatus: typeof TransferStatus.REJECTED | typeof TransferStatus.CANCELLED,
    actor?: PolicyActor,
    rejectReason?: string,
  ): Promise<TransferDTO> {
    const actorId = actor?.sub ?? actor?.id;
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!transfer) {
        throw ApiErrors.notFound("Transfer not found");
      }
      if (actor) {
        if (nextStatus === TransferStatus.CANCELLED) {
          this.authorization?.assertCanCancelTransfer(actor, transfer);
        } else {
          this.authorization?.assertCanApproveTransfer(actor, transfer);
        }
      }

      if (transfer.status !== TransferStatus.PENDING) {
        throw ApiErrors.conflict("Only pending transfers can release reservation");
      }

      for (const item of transfer.items) {
        await tx.inventory.update({
          where: {
            branchId_componentId: {
              branchId: transfer.fromBranchId,
              componentId: item.componentId,
            },
          },
          data: {
            reservedQuantity: { decrement: item.quantity },
            version: { increment: 1 },
          },
        });
      }

      await tx.stockMovement.createMany({
        data: transfer.items.map((item) => ({
          branchId: transfer.fromBranchId,
          componentId: item.componentId,
          movementType: StockMovementType.RESERVATION_RELEASED,
          quantityChange: -item.quantity,
          referenceType: StockMovementReferenceType.TRANSFER,
          referenceId: transfer.id,
          createdBy: actorId,
        })),
      });

      return tx.transfer.update({
        where: { id },
        data: {
          status: nextStatus,
          rejectedBy: nextStatus === TransferStatus.REJECTED ? actorId : undefined,
          rejectedAt: nextStatus === TransferStatus.REJECTED ? new Date() : undefined,
          rejectReason,
        },
        include: {
          fromBranch: true,
          toBranch: true,
          items: { include: { component: true } },
        },
      }) as any;
    });
  }

  private scopeBranchId(branchId: string | undefined, actor?: PolicyActor) {
    if (!actor || actor.role === "ADMIN") return branchId;
    if (!actor.branchId) {
      this.authorization?.assertCanReadTransfer(actor, "__forbidden__", "__forbidden__");
    }
    if (branchId && branchId !== actor.branchId) {
      this.authorization?.assertCanReadTransfer(actor, branchId, "__other__");
    }
    return actor.branchId ?? "__forbidden__";
  }
}
