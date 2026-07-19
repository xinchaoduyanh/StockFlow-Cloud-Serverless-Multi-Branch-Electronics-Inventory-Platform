import {
  StockMovementReferenceType,
  AdjustInventoryBody,
  InventoryQuery,
  InventoryItem,
  Branch,
} from "@stockflow/shared";
import { Injectable } from "@nestjs/common";
import { Prisma, StockMovementType } from "@prisma/client";
import { ApiErrors } from "../common/errors/api-error";
import { toPagination } from "../common/schemas/pagination.schema";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: InventoryQuery): Promise<InventoryItem[]> {
    const { skip, take } = toPagination(query);
    const where: Prisma.InventoryWhereInput = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      component: {
        ...(query.category ? { category: query.category as any } : {}),
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
      const filters = [
        Prisma.sql`i.quantity - i.reserved_quantity <= i.min_stock_threshold`,
        query.branchId ? Prisma.sql`i.branch_id = ${query.branchId}::uuid` : Prisma.sql`TRUE`,
        query.category
          ? Prisma.sql`c.category = ${query.category}::"ComponentCategory"`
          : Prisma.sql`TRUE`,
        query.search
          ? Prisma.sql`(c.sku ILIKE ${`%${query.search}%`} OR c.name ILIKE ${`%${query.search}%`})`
          : Prisma.sql`TRUE`,
      ];
      const lowStockKeys = await this.prisma.$queryRaw<
        Array<{ branchId: string; componentId: string }>
      >`
        SELECT i.branch_id AS "branchId", i.component_id AS "componentId"
        FROM inventory i
        INNER JOIN components c ON c.id = i.component_id
        INNER JOIN branches b ON b.id = i.branch_id
        WHERE ${Prisma.join(filters, " AND ")}
        ORDER BY b.code ASC, c.sku ASC
        LIMIT ${take} OFFSET ${skip}
      `;

      if (!lowStockKeys.length) {
        return [] as InventoryItem[];
      }

      const items = await this.prisma.inventory.findMany({
        where: {
          OR: lowStockKeys.map(({ branchId, componentId }) => ({ branchId, componentId })),
        },
        include: {
          branch: true,
          component: true,
        },
      });
      const order = new Map(
        lowStockKeys.map(({ branchId, componentId }, index) => [
          `${branchId}:${componentId}`,
          index,
        ]),
      );

      return items.sort(
        (left, right) =>
          (order.get(`${left.branchId}:${left.componentId}`) ?? 0) -
          (order.get(`${right.branchId}:${right.componentId}`) ?? 0),
      ) as any;
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
    }) as any;
  }

  getBySku(sku: string): Promise<InventoryItem[]> {
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
    }) as any;
  }

  listByBranch(
    branchId: string,
    query: Omit<InventoryQuery, "branchId">,
  ): Promise<InventoryItem[]> {
    return this.list({ ...query, branchId });
  }

  listBranches(): Promise<Branch[]> {
    return this.prisma.branch.findMany({
      orderBy: { code: "asc" },
    }) as any;
  }

  async adjust(input: AdjustInventoryBody, actorId?: string): Promise<InventoryItem> {
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

      if (existing && nextQuantity < existing.reservedQuantity) {
        throw ApiErrors.badRequest("Inventory quantity cannot be below reserved quantity", {
          reservedQuantity: existing.reservedQuantity,
          nextQuantity,
        });
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
          referenceType: StockMovementReferenceType.INVENTORY_ADJUSTMENT,
          createdBy: actorId,
        },
      });

      return inventory;
    }) as any;
  }
}
