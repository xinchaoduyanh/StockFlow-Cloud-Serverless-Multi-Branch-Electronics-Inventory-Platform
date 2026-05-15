import { Injectable } from "@nestjs/common";
import { Prisma, StockMovementType } from "@prisma/client";
import { ApiErrors } from "../common/errors/api-error";
import { toPagination } from "../common/schemas/pagination.schema";
import { PrismaService } from "../database/prisma.service";
import { AdjustInventoryBody, InventoryQuery } from "./inventory.schemas";

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: InventoryQuery) {
    const { skip, take } = toPagination(query);
    const where: Prisma.InventoryWhereInput = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      component: {
        ...(query.category ? { category: query.category } : {}),
        ...(query.search
          ? {
              OR: [
                { sku: { contains: query.search, mode: "insensitive" } },
                { name: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
    };

    if (query.lowStock) {
      return this.prisma.inventory
        .findMany({
          where,
          include: {
            branch: true,
            component: true,
          },
          orderBy: [{ branch: { code: "asc" } }, { component: { sku: "asc" } }],
        })
        .then((items) =>
          items
            .filter((item) => item.quantity <= item.minStockThreshold)
            .slice(skip, skip + take),
        );
    }

    return this.prisma.inventory.findMany({
      skip,
      take,
      where,
      include: {
        branch: true,
        component: true,
      },
      orderBy: [{ branch: { code: "asc" } }, { component: { sku: "asc" } }],
    });
  }

  getBySku(sku: string) {
    return this.prisma.inventory.findMany({
      where: {
        component: {
          sku,
        },
      },
      include: {
        branch: true,
        component: true,
      },
      orderBy: { branch: { code: "asc" } },
    });
  }

  listByBranch(branchId: string, query: Omit<InventoryQuery, "branchId">) {
    return this.list({ ...query, branchId });
  }

  listBranches() {
    return this.prisma.branch.findMany({
      orderBy: { code: "asc" },
    });
  }

  async adjust(input: AdjustInventoryBody, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.inventory.findUnique({
        where: {
          branchId_componentId: {
            branchId: input.branchId,
            componentId: input.componentId,
          },
        },
      });

      const nextQuantity = (existing?.quantity ?? 0) + input.quantityChange;

      if (nextQuantity < 0) {
        throw ApiErrors.badRequest("Inventory quantity cannot become negative");
      }

      const inventory = await tx.inventory.upsert({
        where: {
          branchId_componentId: {
            branchId: input.branchId,
            componentId: input.componentId,
          },
        },
        update: {
          quantity: { increment: input.quantityChange },
          ...(input.minStockThreshold === undefined
            ? {}
            : { minStockThreshold: input.minStockThreshold }),
          version: { increment: 1 },
        },
        create: {
          branchId: input.branchId,
          componentId: input.componentId,
          quantity: input.quantityChange,
          minStockThreshold: input.minStockThreshold ?? 5,
        },
      });

      await tx.stockMovement.create({
        data: {
          branchId: input.branchId,
          componentId: input.componentId,
          movementType:
            input.quantityChange >= 0
              ? StockMovementType.ADJUSTMENT_IN
              : StockMovementType.ADJUSTMENT_OUT,
          quantityChange: input.quantityChange,
          referenceType: "INVENTORY_ADJUSTMENT",
          createdBy: actorId,
        },
      });

      return inventory;
    });
  }
}
