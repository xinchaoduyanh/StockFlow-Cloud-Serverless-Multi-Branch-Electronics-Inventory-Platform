import { InventoryService } from "./inventory.service";
import { PrismaService } from "../database/prisma.service";
import { AuthorizationPolicyService } from "../auth/authorization-policy.service";

describe("InventoryService invariants", () => {
  const authorization = new AuthorizationPolicyService();

  it("filters low-stock rows in PostgreSQL before pagination", async () => {
    const $queryRaw = jest.fn().mockResolvedValue([
      {
        branchId: "11111111-1111-4111-8111-111111111111",
        componentId: "22222222-2222-4222-8222-222222222222",
      },
    ]);
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

    await new InventoryService(prisma, authorization).list({ page: 1, limit: 2, lowStock: true });

    expect($queryRaw).toHaveBeenCalledTimes(1);
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
