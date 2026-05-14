import { Injectable } from "@nestjs/common";
import { StockMovementType, TransferStatus } from "@prisma/client";
import { ApiErrors } from "../common/errors/api-error";
import { toPagination } from "../common/schemas/pagination.schema";
import { PrismaService } from "../database/prisma.service";
import { CreateTransferBody, RejectTransferBody, TransferListQuery } from "./transfers.schemas";

@Injectable()
export class TransfersService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: TransferListQuery) {
    const { skip, take } = toPagination(query);

    return this.prisma.transfer.findMany({
      skip,
      take,
      where: query.branchId
        ? {
            OR: [
              { fromBranchId: query.branchId },
              { toBranchId: query.branchId },
            ],
          }
        : {},
      include: {
        fromBranch: true,
        toBranch: true,
        items: { include: { component: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async get(id: string) {
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

    return transfer;
  }

  async create(input: CreateTransferBody, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      for (const item of input.items) {
        const inventory = await tx.inventory.findUnique({
          where: {
            branchId_componentId: {
              branchId: input.fromBranchId,
              componentId: item.componentId,
            },
          },
        });

        const available = (inventory?.quantity ?? 0) - (inventory?.reservedQuantity ?? 0);

        if (available < item.quantity) {
          throw ApiErrors.badRequest("Insufficient available stock", {
            componentId: item.componentId,
            available,
            requested: item.quantity,
          });
        }

        await tx.inventory.update({
          where: {
            branchId_componentId: {
              branchId: input.fromBranchId,
              componentId: item.componentId,
            },
          },
          data: {
            reservedQuantity: { increment: item.quantity },
            version: { increment: 1 },
          },
        });
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
        include: { items: true },
      });

      await tx.stockMovement.createMany({
        data: input.items.map((item) => ({
          branchId: input.fromBranchId,
          componentId: item.componentId,
          movementType: StockMovementType.RESERVATION_CREATED,
          quantityChange: item.quantity,
          referenceType: "TRANSFER",
          referenceId: transfer.id,
          createdBy: actorId,
        })),
      });

      return transfer;
    });
  }

  async approve(id: string, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!transfer) {
        throw ApiErrors.notFound("Transfer not found");
      }

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
              referenceType: "TRANSFER",
              referenceId: transfer.id,
              createdBy: actorId,
            },
            {
              branchId: transfer.toBranchId,
              componentId: item.componentId,
              movementType: StockMovementType.TRANSFER_IN,
              quantityChange: item.quantity,
              referenceType: "TRANSFER",
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
        include: { items: true },
      });
    });
  }

  async reject(id: string, input: RejectTransferBody, actorId?: string) {
    return this.releaseReservation(id, TransferStatus.REJECTED, actorId, input.reason);
  }

  async cancel(id: string, actorId?: string) {
    return this.releaseReservation(id, TransferStatus.CANCELLED, actorId);
  }

  private async releaseReservation(
    id: string,
    nextStatus: typeof TransferStatus.REJECTED | typeof TransferStatus.CANCELLED,
    actorId?: string,
    rejectReason?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!transfer) {
        throw ApiErrors.notFound("Transfer not found");
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
          referenceType: "TRANSFER",
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
        include: { items: true },
      });
    });
  }
}
