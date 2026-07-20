import { TransfersService } from "./transfers.service";
import { PrismaService } from "../database/prisma.service";
import { AuthorizationPolicyService } from "../auth/authorization-policy.service";

const input = {
  fromBranchId: "11111111-1111-4111-8111-111111111111",
  toBranchId: "22222222-2222-4222-8222-222222222222",
  items: [
    {
      componentId: "33333333-3333-4333-8333-333333333333",
      quantity: 3,
    },
  ],
};

describe("TransfersService reservation", () => {
  const authorization = new AuthorizationPolicyService();

  it("uses a conditional SQL update for the reservation", async () => {
    const executeRaw = jest.fn().mockResolvedValue(1);
    const transferCreate = jest.fn().mockResolvedValue({ id: "transfer-1" });
    const stockMovementCreateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      $executeRaw: executeRaw,
      transfer: { create: transferCreate },
      stockMovement: { createMany: stockMovementCreateMany },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;

    await new TransfersService(prisma, authorization).create(input);

    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(executeRaw.mock.calls[0][0][0]).toContain('UPDATE "inventory"');
    expect(executeRaw.mock.calls[0][0].join(" ")).toContain('"quantity" - "reserved_quantity"');
    expect(transferCreate).toHaveBeenCalledTimes(1);
    expect(stockMovementCreateMany).toHaveBeenCalledTimes(1);
  });

  it("rejects when the conditional reservation updates no row", async () => {
    const executeRaw = jest.fn().mockResolvedValue(0);
    const findUnique = jest.fn().mockResolvedValue({ quantity: 2, reservedQuantity: 1 });
    const transferCreate = jest.fn();
    const tx = {
      $executeRaw: executeRaw,
      inventory: { findUnique },
      transfer: { create: transferCreate },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;

    await expect(new TransfersService(prisma, authorization).create(input)).rejects.toMatchObject({
      message: expect.stringContaining("Insufficient available stock"),
    });
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(transferCreate).not.toHaveBeenCalled();
  });

  it("reserves multiple components in a stable lock order", async () => {
    const executeRaw = jest.fn().mockResolvedValue(1);
    const tx = {
      $executeRaw: executeRaw,
      transfer: { create: jest.fn().mockResolvedValue({ id: "transfer-2" }) },
      stockMovement: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const higherComponentId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const lowerComponentId = "00000000-0000-4000-8000-000000000001";

    await new TransfersService(prisma, authorization).create({
      ...input,
      items: [
        { componentId: higherComponentId, quantity: 1 },
        { componentId: lowerComponentId, quantity: 1 },
      ],
    });

    expect(executeRaw).toHaveBeenCalledTimes(2);
    expect(executeRaw.mock.calls[0][3]).toBe(lowerComponentId);
    expect(executeRaw.mock.calls[1][3]).toBe(higherComponentId);
  });
});
