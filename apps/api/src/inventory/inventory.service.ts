import {
  StockMovementReferenceType,
  AdjustInventoryBody,
  InventoryQuery,
  InventoryItem,
  InventorySummary,
  Paginated,
  toPaginated,
  Branch,
} from "@stockflow/shared";
import { Injectable } from "@nestjs/common";
import { Prisma, StockMovementType } from "@prisma/client";
import { ApiErrors } from "../common/errors/api-error";
import { toPagination } from "../common/schemas/pagination.schema";
import { PrismaService } from "../database/prisma.service";
import { AuthorizationPolicyService, PolicyActor } from "../auth/authorization-policy.service";

// Prisma rows carry Decimal and enum types that the shared DTO models as plain numbers and
// strings; the client only ever sees the JSON-serialised form, which does match the DTO.
function asInventoryItems(rows: unknown): InventoryItem[] {
  return rows as InventoryItem[];
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationPolicyService,
  ) {}

  async list(query: InventoryQuery, actor?: PolicyActor): Promise<Paginated<InventoryItem>> {
    const scopedQuery = this.scopeQuery(query, actor);
    const { skip, take } = toPagination(scopedQuery);

    if (scopedQuery.lowStock) {
      return this.listLowStock(scopedQuery, skip, take);
    }

    const where = this.buildWhere(scopedQuery);
    const [items, total] = await Promise.all([
      this.prisma.inventory.findMany({
        skip,
        take,
        where,
        include: {
          branch: true,
          component: true,
        },
        orderBy: [{ branch: { code: "asc" } }, { component: { sku: "asc" } }],
      }),
      this.prisma.inventory.count({ where }),
    ]);

    return toPaginated(asInventoryItems(items), total, scopedQuery);
  }

  /** Totals across the whole (branch-scoped) stock, independent of paging, search and category. */
  async summary(
    query: Pick<InventoryQuery, "branchId">,
    actor?: PolicyActor,
  ): Promise<InventorySummary> {
    const scopedQuery = this.scopeQuery({ page: 1, limit: 1, ...query }, actor);
    const where: Prisma.InventoryWhereInput = scopedQuery.branchId
      ? { branchId: scopedQuery.branchId }
      : {};

    const [totals, lowStockCount] = await Promise.all([
      this.prisma.inventory.aggregate({
        where,
        _sum: { quantity: true, reservedQuantity: true },
      }),
      this.countLowStock({ branchId: scopedQuery.branchId }),
    ]);

    return {
      totalUnits: totals._sum.quantity ?? 0,
      reservedUnits: totals._sum.reservedQuantity ?? 0,
      lowStockCount,
    };
  }

  private buildWhere(query: InventoryQuery): Prisma.InventoryWhereInput {
    return {
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
  }

  /** "Low" means available stock (quantity minus reserved) at or below the threshold. */
  private lowStockFilters(query: Pick<InventoryQuery, "branchId" | "category" | "search">) {
    return Prisma.join(
      [
        Prisma.sql`i.quantity - i.reserved_quantity <= i.min_stock_threshold`,
        query.branchId ? Prisma.sql`i.branch_id = ${query.branchId}::uuid` : Prisma.sql`TRUE`,
        query.category
          ? Prisma.sql`c.category = ${query.category}::"ComponentCategory"`
          : Prisma.sql`TRUE`,
        query.search
          ? Prisma.sql`(c.sku ILIKE ${`%${query.search}%`} OR c.name ILIKE ${`%${query.search}%`})`
          : Prisma.sql`TRUE`,
      ],
      " AND ",
    );
  }

  private async countLowStock(
    query: Pick<InventoryQuery, "branchId" | "category" | "search">,
  ): Promise<number> {
    const [row] = await this.prisma.$queryRaw<Array<{ total: number }>>`
      SELECT COUNT(*)::int AS total
      FROM inventory i
      INNER JOIN components c ON c.id = i.component_id
      WHERE ${this.lowStockFilters(query)}
    `;
    return row?.total ?? 0;
  }

  private async listLowStock(
    query: InventoryQuery,
    skip: number,
    take: number,
  ): Promise<Paginated<InventoryItem>> {
    const [lowStockKeys, total] = await Promise.all([
      this.prisma.$queryRaw<Array<{ branchId: string; componentId: string }>>`
        SELECT i.branch_id AS "branchId", i.component_id AS "componentId"
        FROM inventory i
        INNER JOIN components c ON c.id = i.component_id
        INNER JOIN branches b ON b.id = i.branch_id
        WHERE ${this.lowStockFilters(query)}
        ORDER BY b.code ASC, c.sku ASC
        LIMIT ${take} OFFSET ${skip}
      `,
      this.countLowStock(query),
    ]);

    if (!lowStockKeys.length) {
      return toPaginated<InventoryItem>([], total, query);
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
      lowStockKeys.map(({ branchId, componentId }, index) => [`${branchId}:${componentId}`, index]),
    );
    const sorted = items.sort(
      (left, right) =>
        (order.get(`${left.branchId}:${left.componentId}`) ?? 0) -
        (order.get(`${right.branchId}:${right.componentId}`) ?? 0),
    );

    return toPaginated(asInventoryItems(sorted), total, query);
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
  ): Promise<Paginated<InventoryItem>> {
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
