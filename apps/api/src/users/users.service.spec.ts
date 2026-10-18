import { UsersService } from "./users.service";
import { PrismaService } from "../database/prisma.service";

describe("UsersService list", () => {
  it("returns one page of users with the total head count", async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: "u1",
        email: "an@example.test",
        fullName: "An",
        role: "ADMIN",
        status: "ACTIVE",
        branchId: null,
        createdAt: new Date("2026-10-01"),
        updatedAt: new Date("2026-10-02"),
      },
    ]);
    const count = jest.fn().mockResolvedValue(25);
    const prisma = { user: { findMany, count } } as unknown as PrismaService;
    const service = new UsersService(prisma, { get: jest.fn(() => undefined) } as never);

    const page = await service.list({ page: 3, limit: 10 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
    expect(page).toMatchObject({ total: 25, page: 3, limit: 10 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ id: "u1", email: "an@example.test" });
  });
});
