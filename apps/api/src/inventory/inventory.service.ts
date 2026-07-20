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
import { AuthorizationPolicyService, PolicyActor } from "../auth/authorization-policy.service";

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationPolicyService,
  ) {}

  async list(query: InventoryQuery, actor?: PolicyActor): Promise<InventoryItem[]> {
    const scopedQuery = this.scopeQuery(query, actor);
    const { skip, take } = toPagination(scopedQuery);
    const where: Prisma.InventoryWhereInput = {
      ...(scopedQuery.branchId ? { branchId: scopedQuery.branchId } : {}),
      component: {
        ...(scopedQuery.category ? { category: scopedQuery.category as any } : {}),
        ...(scopedQuery.search
          ? {
              OR: [
                { sku: { contains: query.search, mode: "insensitive" } },
                { name: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
    };

    if (scopedQuery.lowStock) {
      const filters = [
        Prisma.sql`i.quantity - i.reserved_quantity <= i.min_stock_threshold`,
        scopedQuery.branchId
          ? Prisma.sql`i.branch_id = ${scopedQuery.branchId}::uuid`
          : Prisma.sql`TRUE`,
        scopedQuery.category
          ? Prisma.sql`c.category = ${scopedQuery.category}::"ComponentCategory"`
          : Prisma.sql`TRUE`,
        scopedQuery.search
          ? Prisma.sql`(c.sku ILIKE ${`%${scopedQuery.search}%`} OR c.name ILIKE ${`%${scopedQuery.search}%`})`
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

  getBySku(sku: string, actor?: PolicyActor): Promise<InventoryItem[]> {
    return this.prisma.inventory.findMany({
      where: {
        ...(actor && actor.role !== "ADMIN" ? { branchId: actor.branchId ?? "__forbidden__" } : {}),
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
    actor?: PolicyActor,
  ): Promise<InventoryItem[]> {
    if (actor) this.authorization.assertCanReadBranch(actor, branchId);
    return this.list({ ...query, branchId }, actor);
  }

  listBranches(actor?: PolicyActor): Promise<Branch[]> {
    return this.prisma.branch.findMany({
      where:
        actor && actor.role !== "ADMIN" ? { id: actor.branchId ?? "__forbidden__" } : undefined,
      orderBy: { code: "asc" },
    }) as any;
  }

  async adjust(input: AdjustInventoryBody, actor?: PolicyActor): Promise<InventoryItem> {
    if (actor) this.authorization.assertCanAdjustInventory(actor, input.branchId);
    const actorId = actor?.sub ?? actor?.id;
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

  private scopeQuery(query: InventoryQuery, actor?: PolicyActor): InventoryQuery {
    if (!actor || actor.role === "ADMIN") return query;
    const branchId = actor.branchId;
    if (!branchId) {
      this.authorization.assertCanReadBranch(actor, "__forbidden__");
      return query;
    }
    if (query.branchId && query.branchId !== branchId) {
      this.authorization.assertCanReadBranch(actor, query.branchId);
    }
    return { ...query, branchId };
  }
}
