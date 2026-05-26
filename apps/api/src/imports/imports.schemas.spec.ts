import { importRowInputSchema, ComponentCategory } from "@stockflow/shared";

describe("Imports Schemas Validation", () => {
  describe("importRowInputSchema", () => {
    const baseRow = {
      sku: "SKU-BASE-123",
      name: "Base Component",
      brand: "BrandX",
      supplier: "SupplierA",
      unitPrice: 100,
      warrantyMonths: 12,
    };

    it("should accept valid RAM row and reject invalid RAM", () => {
      const validRam = {
        ...baseRow,
        category: ComponentCategory.RAM,
        quantity: 10,
        ddrGeneration: "DDR4",
        speedMhz: 3200,
        capacityGb: 16,
      };
      expect(importRowInputSchema.safeParse(validRam).success).toBe(true);

      const invalidRam = {
        ...baseRow,
        category: ComponentCategory.RAM,
        quantity: 10,
        speedMhz: 3200,
        // ddrGeneration and capacityGb are missing
      };
      const result = importRowInputSchema.safeParse(invalidRam);
      expect(result.success).toBe(false);
    });

    it("should enforce strictly positive quantity check", () => {
      const rowWithZeroQty = {
        ...baseRow,
        category: ComponentCategory.GPU,
        quantity: 0,
        vramGb: 8,
      };
      const resultZero = importRowInputSchema.safeParse(rowWithZeroQty);
      expect(resultZero.success).toBe(false);
      if (!resultZero.success) {
        expect(resultZero.error.issues[0].message).toContain("quantity must be greater than 0");
      }

      const rowWithNegQty = {
        ...baseRow,
        category: ComponentCategory.GPU,
        quantity: -5,
        vramGb: 8,
      };
      const resultNeg = importRowInputSchema.safeParse(rowWithNegQty);
      expect(resultNeg.success).toBe(false);
    });

    it("should validate PSU specific specs", () => {
      const validPsu = {
        ...baseRow,
        category: ComponentCategory.PSU,
        quantity: 5,
        wattage: 750,
        efficiencyRating: "80+ Gold",
        modular: "Full",
      };
      expect(importRowInputSchema.safeParse(validPsu).success).toBe(true);

      const invalidPsuMissingWattage = {
        ...baseRow,
        category: ComponentCategory.PSU,
        quantity: 5,
        efficiencyRating: "80+ Gold",
        modular: "Full",
      };
      const result = importRowInputSchema.safeParse(invalidPsuMissingWattage);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("wattage is required for PSU");
      }
    });

    it("should validate CASE specific specs", () => {
      const validCase = {
        ...baseRow,
        category: ComponentCategory.CASE,
        quantity: 3,
        caseSize: "Mid Tower",
        supportedMainboard: "ATX, Micro-ATX",
      };
      expect(importRowInputSchema.safeParse(validCase).success).toBe(true);

      const invalidCaseMissingSize = {
        ...baseRow,
        category: ComponentCategory.CASE,
        quantity: 3,
        supportedMainboard: "ATX",
      };
      const result = importRowInputSchema.safeParse(invalidCaseMissingSize);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("caseSize is required for CASE");
      }
    });

    it("should validate COOLER specific specs", () => {
      const validCooler = {
        ...baseRow,
        category: ComponentCategory.COOLER,
        quantity: 12,
        coolerType: "AIO",
        supportedSocket: "LGA1700, AM5",
      };
      expect(importRowInputSchema.safeParse(validCooler).success).toBe(true);

      const invalidCoolerMissingType = {
        ...baseRow,
        category: ComponentCategory.COOLER,
        quantity: 12,
        supportedSocket: "AM4",
      };
      const result = importRowInputSchema.safeParse(invalidCoolerMissingType);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("coolerType is required for COOLER");
      }
    });
  });
});
