const ExcelJS = require("exceljs");
const path = require("path");

async function generateSample() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Components Ingestion");

  // Define Columns
  worksheet.columns = [
    { header: "sku", key: "sku", width: 15 },
    { header: "name", key: "name", width: 30 },
    { header: "brand", key: "brand", width: 15 },
    { header: "category", key: "category", width: 12 },
    { header: "quantity", key: "quantity", width: 10 },
    { header: "unitPrice", key: "unitPrice", width: 12 },
    { header: "supplier", key: "supplier", width: 25 },
    { header: "warrantyMonths", key: "warrantyMonths", width: 15 },
    
    // RAM Specs
    { header: "ddrGeneration", key: "ddrGeneration", width: 15 },
    { header: "speedMhz", key: "speedMhz", width: 12 },
    { header: "capacityGb", key: "capacityGb", width: 12 },
    
    // CPU Specs
    { header: "socket", key: "socket", width: 12 },
    { header: "cores", key: "cores", width: 10 },
    { header: "threads", key: "threads", width: 10 },
    
    // Storage (SSD) Specs
    { header: "interface", key: "interface", width: 12 },
    { header: "formFactor", key: "formFactor", width: 12 },
    
    // GPU Specs
    { header: "vramGb", key: "vramGb", width: 10 },
    { header: "chipset", key: "chipset", width: 15 },
    
    // PSU Specs
    { header: "wattage", key: "wattage", width: 10 },
    { header: "efficiencyRating", key: "efficiencyRating", width: 15 },
    { header: "modular", key: "modular", width: 10 },
    
    // Case Specs
    { header: "caseSize", key: "caseSize", width: 12 },
    { header: "supportedMainboard", key: "supportedMainboard", width: 20 },
    
    // Cooler Specs
    { header: "coolerType", key: "coolerType", width: 15 },
    { header: "supportedSocket", key: "supportedSocket", width: 20 }
  ];

  // Add realistic, detailed sample data
  worksheet.addRows([
    // 1. Valid RAM Component
    {
      sku: "RAM-COR-DDR5-32",
      name: "Vengeance RGB 32GB DDR5 Kit",
      brand: "Corsair",
      category: "RAM",
      quantity: 15,
      unitPrice: 129.99,
      supplier: "Khải Thiên Distribution",
      warrantyMonths: 36,
      ddrGeneration: "DDR5",
      speedMhz: 6000,
      capacityGb: 32
    },
    // 2. Valid CPU Component
    {
      sku: "CPU-INT-I7-14700K",
      name: "Intel Core i7-14700K Desktop CPU",
      brand: "Intel",
      category: "CPU",
      quantity: 8,
      unitPrice: 409.99,
      supplier: "Viễn Sơn Technology",
      warrantyMonths: 36,
      socket: "LGA1700",
      cores: 20,
      threads: 28
    },
    // 3. Valid GPU Component
    {
      sku: "GPU-ASU-RTX4080S",
      name: "ROG Strix RTX 4080 Super OC",
      brand: "ASUS",
      category: "GPU",
      quantity: 5,
      unitPrice: 1049.99,
      supplier: "Mộc Thủy Distribution",
      warrantyMonths: 36,
      vramGb: 16,
      chipset: "RTX 4080 Super"
    },
    // 4. Valid PSU Component (Testing upgraded PSU specs)
    {
      sku: "PSU-COR-RM850X",
      name: "RM850x 850W Gold PSU",
      brand: "Corsair",
      category: "PSU",
      quantity: 12,
      unitPrice: 149.99,
      supplier: "Khải Thiên Distribution",
      warrantyMonths: 120,
      wattage: 850,
      efficiencyRating: "80 Plus Gold",
      modular: "Full"
    },
    // 5. Valid PC Case Component (Testing upgraded Case specs)
    {
      sku: "CASE-NZXT-H9F-B",
      name: "H9 Flow Dual-Chamber Mid-Tower",
      brand: "NZXT NZXT",
      category: "CASE",
      quantity: 10,
      unitPrice: 159.99,
      supplier: "Viễn Sơn Technology",
      warrantyMonths: 24,
      caseSize: "Mid-Tower",
      supportedMainboard: "ATX, Micro-ATX, Mini-ITX"
    },
    // 6. Intentionally INVALID Row (To verify validation alerts - missing speedMhz and capacityGb for RAM)
    {
      sku: "RAM-KIN-DDR4-ERR",
      name: "Kingston Fury Beast 16GB DDR4",
      brand: "Kingston",
      category: "RAM",
      quantity: 20,
      unitPrice: 49.99,
      supplier: "Khải Thiên Distribution",
      warrantyMonths: 36,
      ddrGeneration: "DDR4" // ERROR: speedMhz and capacityGb are missing for RAM!
    },
    // 7. Intentionally INVALID Row (To verify negative quantity blocker)
    {
      sku: "CPU-AMD-5600X-ERR",
      name: "Ryzen 5 5600X CPU",
      brand: "AMD",
      category: "CPU",
      quantity: -5, // ERROR: Quantity must be positive!
      unitPrice: 159.99,
      supplier: "Viễn Sơn Technology",
      warrantyMonths: 36,
      socket: "AM4",
      cores: 6,
      threads: 12
    }
  ]);

  // Style headers
  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4F81BD" }
  };

  const outputPath = path.join(__dirname, "../../sample_import.xlsx");
  await workbook.xlsx.writeFile(outputPath);
  console.log(`✅ Sample spreadsheet generated successfully at: ${outputPath}`);
}

generateSample().catch(console.error);
