import { InventoryService } from "./inventory.service";
import { PrismaService } from "../database/prisma.service";
import { AuthorizationPolicyService } from "../auth/authorization-policy.service";

describe("InventoryService invariants", () => {
  const authorization = new AuthorizationPolicyService();

  it("filters low-stock rows in PostgreSQL before pagination", async () => {
    const $queryRaw = jest
      .fn()
      .mockResolvedValueOnce([
        {
          branchId: "11111111-1111-4111-8111-111111111111",
          componentId: "22222222-2222-4222-8222-222222222222",
        },
      ])
      .mockResolvedValueOnce([{ total: 7 }]);
    const findMany = jest.fn().mockResolvedValue([
      {
        branchId: "11111111-1111-4111-8111-111111111111",
        componentId: "22222222-2222-4222-8222-222222222222",
      },
    ]);
    const prisma = {
      $queryRaw,
      inventory: { findMany },
    } as unknown as PrismaService;

    const page = await new InventoryService(prisma, authorization).list({
      page: 1,
      limit: 2,
      lowStock: true,
    });

    expect($queryRaw).toHaveBeenCalledTimes(2);
    expect(page).toMatchObject({ total: 7, page: 1, limit: 2 });
    expect(page.items).toHaveLength(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            {
              branchId: "11111111-1111-4111-8111-111111111111",
              componentId: "22222222-2222-4222-8222-222222222222",
            },
          ],
        },
      }),
    );
  });

  it("returns the matching total with each page, not the page length", async () => {
    const rows = [{ branchId: "b1", componentId: "c1" }];
    const findMany = jest.fn().mockResolvedValue(rows);
    const count = jest.fn().mockResolvedValue(48);
    const prisma = { inventory: { findMany, count } } as unknown as PrismaService;

    const page = await new InventoryService(prisma, authorization).list({ page: 3, limit: 8 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 16, take: 8 }));
    expect(count).toHaveBeenCalledWith({ where: expect.any(Object) });
    expect(page).toEqual({ items: rows, total: 48, page: 3, limit: 8 });
  });

  it("summarises units across every row of the branch, not one page", async () => {
    const aggregate = jest
      .fn()
      .mockResolvedValue({ _sum: { quantity: 1021, reservedQuantity: 64 } });
    const $queryRaw = jest.fn().mockResolvedValue([{ total: 8 }]);
    const prisma = { inventory: { aggregate }, $queryRaw } as unknown as PrismaService;

    const summary = await new InventoryService(prisma, authorization).summary({
      branchId: "11111111-1111-4111-8111-111111111111",
    });

    expect(aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { branchId: "11111111-1111-4111-8111-111111111111" } }),
    );
    expect(summary).toEqual({ totalUnits: 1021, reservedUnits: 64, lowStockCount: 8 });
  });

  it("treats an empty branch as zero units", async () => {
    const aggregate = jest
      .fn()
      .mockResolvedValue({ _sum: { quantity: null, reservedQuantity: null } });
    const prisma = {
      inventory: { aggregate },
      $queryRaw: jest.fn().mockResolvedValue([{ total: 0 }]),
    } as unknown as PrismaService;

    await expect(new InventoryService(prisma, authorization).summary({})).resolves.toEqual({
      totalUnits: 0,
      reservedUnits: 0,
      lowStockCount: 0,
    });
  });

  it("rejects an adjustment that would consume reserved stock", async () => {
    const tx = {
      inventory: {
        findUnique: jest.fn().mockResolvedValue({ quantity: 10, reservedQuantity: 8 }),
        upsert: jest.fn(),
      },
      stockMovement: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;

    await expect(
      new InventoryService(prisma, authorization).adjust({
        branchId: "11111111-1111-4111-8111-111111111111",
        componentId: "22222222-2222-4222-8222-222222222222",
        quantityChange: -3,
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining("below reserved quantity"),
    });
    expect(tx.inventory.upsert).not.toHaveBeenCalled();
  });
});
