import { PrismaService } from "../database/prisma.service";
import { ReportsService, selectLowStock } from "./reports.service";

describe("selectLowStock", () => {
  it("counts reserved quantity as unavailable", () => {
    const items = [
      { sku: "A", quantity: 12, reservedQuantity: 6, minStockThreshold: 8 },
      { sku: "B", quantity: 12, reservedQuantity: 0, minStockThreshold: 8 },
    ];

    expect(selectLowStock(items).map((i) => i.sku)).toEqual(["A"]);
  });
});

describe("ReportsService.listExports", () => {
  it("returns the total of the caller's exports with the page", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(23);
    const prisma = { exportJob: { findMany, count } } as unknown as PrismaService;
    const service = new ReportsService(prisma, {} as never, {} as never, {} as never, {} as never);

    const page = await service.listExports({ page: 3, limit: 10 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
    expect(page).toEqual({ items: [], total: 23, page: 3, limit: 10 });
  });
});
