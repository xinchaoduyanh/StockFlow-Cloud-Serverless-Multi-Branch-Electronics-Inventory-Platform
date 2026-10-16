import { selectLowStock } from "./reports.service";

describe("selectLowStock", () => {
  it("counts reserved quantity as unavailable", () => {
    const items = [
      { sku: "A", quantity: 12, reservedQuantity: 6, minStockThreshold: 8 },
      { sku: "B", quantity: 12, reservedQuantity: 0, minStockThreshold: 8 },
    ];

    expect(selectLowStock(items).map((i) => i.sku)).toEqual(["A"]);
  });
});
