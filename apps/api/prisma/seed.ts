import {
  ComponentCategory,
  ImportRowStatus,
  ImportStatus,
  PrismaClient,
  StockMovementReferenceType,
  StockMovementType,
  TransferStatus,
  UserRole,
} from "@prisma/client";
import { hashPassword } from "../src/auth/password";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed database with rich electronic components data...");

  // Clean old transactional data for complete seed idempotency
  console.log("🧹 Cleaning up old transactional data...");
  await prisma.importJobRow.deleteMany({});
  await prisma.importJob.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.transferItem.deleteMany({});
  await prisma.transfer.deleteMany({});
  await prisma.inventory.deleteMany({});

  // 1. Seed Branches
  console.log("🏢 Seeding branches...");
  const branchHN = await prisma.branch.upsert({
    where: { code: "BR001" },
    update: {},
    create: {
      code: "BR001",
      name: "Chi nhánh Hà Nội (Main Branch)",
      address: "123 Đường Cầu Giấy, Quận Cầu Giấy, Hà Nội",
    },
  });

  const branchHCM = await prisma.branch.upsert({
    where: { code: "BR002" },
    update: {},
    create: {
      code: "BR002",
      name: "Chi nhánh TP. HCM (South Branch)",
      address: "456 Đường Nguyễn Thị Minh Khai, Quận 1, TP. HCM",
    },
  });

  const branchDN = await prisma.branch.upsert({
    where: { code: "BR003" },
    update: {},
    create: {
      code: "BR003",
      name: "Chi nhánh Đà Nẵng (Central Branch)",
      address: "789 Đường Lê Duẩn, Quận Hải Châu, Đà Nẵng",
    },
  });

  // 2. Seed Users
  console.log("👥 Seeding users...");
  const pwdDefault = await hashPassword("123");

  const userAdmin = await prisma.user.upsert({
    where: { email: "duyanh19122k3+admin@gmail.com" },
    update: {
      passwordHash: pwdDefault,
      cognitoSub: "f93aa58c-40e1-70d1-5f84-f00c62ac6f8c",
    },
    create: {
      email: "duyanh19122k3+admin@gmail.com",
      fullName: "Nguyễn Admin Tổng",
      passwordHash: pwdDefault,
      cognitoSub: "f93aa58c-40e1-70d1-5f84-f00c62ac6f8c",
      role: UserRole.ADMIN,
    },
  });

  const userManagerHN = await prisma.user.upsert({
    where: { email: "duyanh19122k3+manager_hn@gmail.com" },
    update: {
      passwordHash: pwdDefault,
      cognitoSub: "e96a959c-40e1-70e2-2029-b8101b2980ce",
    },
    create: {
      email: "duyanh19122k3+manager_hn@gmail.com",
      fullName: "Trần Hà Nội Manager",
      passwordHash: pwdDefault,
      cognitoSub: "e96a959c-40e1-70e2-2029-b8101b2980ce",
      role: UserRole.STORE_MANAGER,
      branchId: branchHN.id,
    },
  });

  const userManagerHCM = await prisma.user.upsert({
    where: { email: "duyanh19122k3+manager_hcm@gmail.com" },
    update: {
      passwordHash: pwdDefault,
      cognitoSub: "f98aa52c-5011-705d-bfe6-77827c852cbf",
    },
    create: {
      email: "duyanh19122k3+manager_hcm@gmail.com",
      fullName: "Lê Sài Gòn Manager",
      passwordHash: pwdDefault,
      cognitoSub: "f98aa52c-5011-705d-bfe6-77827c852cbf",
      role: UserRole.STORE_MANAGER,
      branchId: branchHCM.id,
    },
  });

  const userWarehouse = await prisma.user.upsert({
    where: { email: "duyanh19122k3+warehouse@gmail.com" },
    update: {
      passwordHash: pwdDefault,
      cognitoSub: "694a450c-2081-70e3-8446-a84689aa9d1f",
    },
    create: {
      email: "duyanh19122k3+warehouse@gmail.com",
      fullName: "Phạm Kho Vận",
      passwordHash: pwdDefault,
      cognitoSub: "694a450c-2081-70e3-8446-a84689aa9d1f",
      role: UserRole.WAREHOUSE,
    },
  });

  // 3. Seed Components (Electronics items with specific specs)
  console.log("💻 Seeding components...");

  // CPUs
  const cpuIntel = await prisma.component.upsert({
    where: { sku: "CPU-INTEL-I5-12400F" },
    update: {},
    create: {
      sku: "CPU-INTEL-I5-12400F",
      name: "Intel Core i5 12400F (Up To 4.4GHz, 6 Cores 12 Threads)",
      brand: "Intel",
      category: ComponentCategory.CPU,
      specs: {
        socket: "LGA1700",
        cores: 6,
        threads: 12,
      },
      unitPrice: 3200000,
      supplier: "Mai Hoàng Distribution",
      warrantyMonths: 36,
    },
  });

  const cpuAMD = await prisma.component.upsert({
    where: { sku: "CPU-AMD-R5-5600X" },
    update: {},
    create: {
      sku: "CPU-AMD-R5-5600X",
      name: "AMD Ryzen 5 5600X (Up To 4.6GHz, 6 Cores 12 Threads)",
      brand: "AMD",
      category: ComponentCategory.CPU,
      specs: {
        socket: "AM4",
        cores: 6,
        threads: 12,
      },
      unitPrice: 3850000,
      supplier: "Thủy Linh Computer",
      warrantyMonths: 36,
    },
  });

  const cpuIntel9 = await prisma.component.upsert({
    where: { sku: "CPU-INTEL-I9-13900K" },
    update: {},
    create: {
      sku: "CPU-INTEL-I9-13900K",
      name: "Intel Core i9 13900K (Up To 5.8GHz, 24 Cores 32 Threads)",
      brand: "Intel",
      category: ComponentCategory.CPU,
      specs: {
        socket: "LGA1700",
        cores: 24,
        threads: 32,
      },
      unitPrice: 13900000,
      supplier: "Viễn Sơn JSC",
      warrantyMonths: 36,
    },
  });

  // RAMs
  const ramKingston = await prisma.component.upsert({
    where: { sku: "RAM-KING-8-DDR4" },
    update: {},
    create: {
      sku: "RAM-KING-8-DDR4",
      name: "Kingston Fury Beast 8GB DDR4 3200MHz",
      brand: "Kingston",
      category: ComponentCategory.RAM,
      specs: {
        ddrGeneration: "DDR4",
        speedMhz: 3200,
        capacityGb: 8,
      },
      unitPrice: 550000,
      supplier: "Khải Thiên Distribution",
      warrantyMonths: 36,
    },
  });

  const ramCorsair = await prisma.component.upsert({
    where: { sku: "RAM-CORS-16-DDR5" },
    update: {},
    create: {
      sku: "RAM-CORS-16-DDR5",
      name: "Corsair Vengeance RGB 16GB (2x8GB) DDR5 5600MHz",
      brand: "Corsair",
      category: ComponentCategory.RAM,
      specs: {
        ddrGeneration: "DDR5",
        speedMhz: 5600,
        capacityGb: 16,
      },
      unitPrice: 1850000,
      supplier: "Khải Thiên Distribution",
      warrantyMonths: 36,
    },
  });

  // SSDs
  const ssdSamsung = await prisma.component.upsert({
    where: { sku: "SSD-SAM-980-1TB" },
    update: {},
    create: {
      sku: "SSD-SAM-980-1TB",
      name: "Samsung 980 1TB M.2 PCIe NVMe",
      brand: "Samsung",
      category: ComponentCategory.SSD,
      specs: {
        interface: "NVMe",
        capacityGb: 1000,
        formFactor: "M.2 2280",
      },
      unitPrice: 1690000,
      supplier: "AMC Distribution",
      warrantyMonths: 60,
    },
  });

  const ssdKingston = await prisma.component.upsert({
    where: { sku: "SSD-KING-240-SATA" },
    update: {},
    create: {
      sku: "SSD-KING-240-SATA",
      name: "Kingston A400 240GB 2.5-inch SATA III",
      brand: "Kingston",
      category: ComponentCategory.SSD,
      specs: {
        interface: "SATA",
        capacityGb: 240,
        formFactor: "2.5-inch",
      },
      unitPrice: 420000,
      supplier: "Viễn Sơn JSC",
      warrantyMonths: 36,
    },
  });

  // GPUs
  const gpuAsus = await prisma.component.upsert({
    where: { sku: "GPU-ASUS-4070-12G" },
    update: {},
    create: {
      sku: "GPU-ASUS-4070-12G",
      name: "ASUS ROG Strix GeForce RTX 4070 Gaming 12GB GDDR6X",
      brand: "ASUS",
      category: ComponentCategory.GPU,
      specs: {
        vramGb: 12,
      },
      unitPrice: 19800000,
      supplier: "Viễn Sơn JSC",
      warrantyMonths: 36,
    },
  });

  const gpuMsi = await prisma.component.upsert({
    where: { sku: "GPU-MSI-3060-12G" },
    update: {},
    create: {
      sku: "GPU-MSI-3060-12G",
      name: "MSI GeForce RTX 3060 VENTUS 2X 12G OC",
      brand: "MSI",
      category: ComponentCategory.GPU,
      specs: {
        vramGb: 12,
      },
      unitPrice: 7900000,
      supplier: "Mai Hoàng Distribution",
      warrantyMonths: 36,
    },
  });

  // Mainboard
  const mainboardAsus = await prisma.component.upsert({
    where: { sku: "MBD-ASUS-B760M" },
    update: {},
    create: {
      sku: "MBD-ASUS-B760M",
      name: "ASUS TUF GAMING B760M-PLUS WIFI DDR4",
      brand: "ASUS",
      category: ComponentCategory.MAINBOARD,
      specs: {
        socket: "LGA1700",
        chipset: "B760",
      },
      unitPrice: 3990000,
      supplier: "Viễn Sơn JSC",
      warrantyMonths: 36,
    },
  });

  // 4. Seed Inventory and Stock Movements
  console.log("📦 Seeding inventory and stock movements...");

  // List of inventory mappings: branch, component, quantity, reserved, minStock
  const initialStocks = [
    // Branch Hà Nội (BR001)
    { branchId: branchHN.id, componentId: cpuIntel.id, quantity: 45, reserved: 3, minStock: 5 },
    { branchId: branchHN.id, componentId: cpuAMD.id, quantity: 20, reserved: 0, minStock: 5 },
    { branchId: branchHN.id, componentId: cpuIntel9.id, quantity: 4, reserved: 1, minStock: 5 }, // Low stock shortage (actual 4 < minStock 5)
    {
      branchId: branchHN.id,
      componentId: ramKingston.id,
      quantity: 120,
      reserved: 10,
      minStock: 15,
    },
    { branchId: branchHN.id, componentId: ramCorsair.id, quantity: 50, reserved: 0, minStock: 10 },
    { branchId: branchHN.id, componentId: ssdSamsung.id, quantity: 80, reserved: 5, minStock: 10 },
    { branchId: branchHN.id, componentId: ssdKingston.id, quantity: 3, reserved: 0, minStock: 10 }, // Low stock shortage
    { branchId: branchHN.id, componentId: gpuAsus.id, quantity: 15, reserved: 2, minStock: 3 },
    { branchId: branchHN.id, componentId: gpuMsi.id, quantity: 2, reserved: 0, minStock: 8 }, // Low stock shortage
    {
      branchId: branchHN.id,
      componentId: mainboardAsus.id,
      quantity: 30,
      reserved: 0,
      minStock: 8,
    },

    // Branch TP.HCM (BR002)
    { branchId: branchHCM.id, componentId: cpuIntel.id, quantity: 30, reserved: 0, minStock: 5 },
    { branchId: branchHCM.id, componentId: cpuAMD.id, quantity: 25, reserved: 2, minStock: 5 },
    { branchId: branchHCM.id, componentId: cpuIntel9.id, quantity: 8, reserved: 0, minStock: 3 },
    {
      branchId: branchHCM.id,
      componentId: ramKingston.id,
      quantity: 90,
      reserved: 0,
      minStock: 15,
    },
    { branchId: branchHCM.id, componentId: ramCorsair.id, quantity: 1, reserved: 0, minStock: 5 }, // Low stock shortage
    { branchId: branchHCM.id, componentId: ssdSamsung.id, quantity: 40, reserved: 0, minStock: 10 },
    { branchId: branchHCM.id, componentId: gpuAsus.id, quantity: 6, reserved: 0, minStock: 3 },
    { branchId: branchHCM.id, componentId: gpuMsi.id, quantity: 12, reserved: 4, minStock: 8 },
  ];

  for (const stock of initialStocks) {
    // Seed inventory state
    await prisma.inventory.upsert({
      where: {
        branchId_componentId: {
          branchId: stock.branchId,
          componentId: stock.componentId,
        },
      },
      update: {
        quantity: stock.quantity,
        reservedQuantity: stock.reserved,
        minStockThreshold: stock.minStock,
      },
      create: {
        branchId: stock.branchId,
        componentId: stock.componentId,
        quantity: stock.quantity,
        reservedQuantity: stock.reserved,
        minStockThreshold: stock.minStock,
      },
    });

    // Seed stock movement ledger
    await prisma.stockMovement.create({
      data: {
        branchId: stock.branchId,
        componentId: stock.componentId,
        movementType: StockMovementType.IMPORT_IN,
        quantityChange: stock.quantity,
        referenceType: StockMovementReferenceType.SYSTEM_SEED,
        createdBy: userAdmin.id,
      },
    });
  }

  // 5. Seed Transfers
  console.log("✈️ Seeding transfer requests...");

  // Transfer 1: Pending (BR001 -> BR002) - CPU Intel i5
  const transfer1 = await prisma.transfer.create({
    data: {
      fromBranchId: branchHN.id,
      toBranchId: branchHCM.id,
      status: TransferStatus.PENDING,
      requestedBy: userManagerHN.id,
      note: "Chuyển gấp 3 con Core i5 cho chi nhánh HCM lắp PC ráp sẵn.",
      items: {
        create: {
          componentId: cpuIntel.id,
          quantity: 3,
        },
      },
    },
  });

  // Transfer 2: Completed (BR002 -> BR001) - GPU MSI RTX 3060
  const transfer2 = await prisma.transfer.create({
    data: {
      fromBranchId: branchHCM.id,
      toBranchId: branchHN.id,
      status: TransferStatus.COMPLETED,
      requestedBy: userManagerHCM.id,
      approvedBy: userAdmin.id,
      note: "Hà Nội thiếu hàng RTX 3060, chi nhánh HCM chi viện 4 con.",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      approvedAt: new Date(Date.now() - 2.9 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 2.8 * 24 * 60 * 60 * 1000),
      items: {
        create: {
          componentId: gpuMsi.id,
          quantity: 4,
        },
      },
    },
  });

  // Records stock movements for Transfer 2 completed
  await prisma.stockMovement.createMany({
    data: [
      {
        branchId: branchHCM.id,
        componentId: gpuMsi.id,
        movementType: StockMovementType.TRANSFER_OUT,
        quantityChange: -4,
        referenceType: StockMovementReferenceType.TRANSFER,
        referenceId: transfer2.id,
        createdBy: userAdmin.id,
        createdAt: transfer2.completedAt!,
      },
      {
        branchId: branchHN.id,
        componentId: gpuMsi.id,
        movementType: StockMovementType.TRANSFER_IN,
        quantityChange: 4,
        referenceType: StockMovementReferenceType.TRANSFER,
        referenceId: transfer2.id,
        createdBy: userAdmin.id,
        createdAt: transfer2.completedAt!,
      },
    ],
  });

  // Transfer 3: Rejected (BR001 -> BR002) - CPU Intel i9 (requesting 1)
  await prisma.transfer.create({
    data: {
      fromBranchId: branchHN.id,
      toBranchId: branchHCM.id,
      status: TransferStatus.REJECTED,
      requestedBy: userManagerHCM.id,
      rejectedBy: userWarehouse.id,
      note: "Xin chuyển 1 con CPU i9 13900K từ HN vào HCM.",
      rejectReason:
        "Kho HN hiện chỉ còn 4 chiếc khả dụng (available), chạm ngưỡng tối thiểu nên không thể duyệt chuyển.",
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      rejectedAt: new Date(),
      items: {
        create: {
          componentId: cpuIntel9.id,
          quantity: 1,
        },
      },
    },
  });

  // 6. Seed Import Jobs (To showcase preview, completed, and error history)
  console.log("📥 Seeding import jobs...");

  // Import Job 1: Completed successfully
  const importJob1 = await prisma.importJob.create({
    data: {
      branchId: branchHN.id,
      fileName: "Dot_Nhap_Hang_Dau_Thang_5.xlsx",
      status: ImportStatus.COMPLETED,
      totalRows: 3,
      processedRows: 3,
      validRows: 3,
      invalidRows: 0,
      committedRows: 3,
      createdBy: userManagerHN.id,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000),
    },
  });

  // Seed rows for Import Job 1
  await prisma.importJobRow.createMany({
    data: [
      {
        importJobId: importJob1.id,
        rowNumber: 2,
        sku: "CPU-INTEL-I5-12400F",
        validationStatus: ImportRowStatus.COMMITTED,
        rawData: {
          sku: "CPU-INTEL-I5-12400F",
          name: "Intel Core i5 12400F",
          brand: "Intel",
          category: "CPU",
          quantity: 20,
          unit_price: 3200000,
        },
        normalizedData: {
          sku: "CPU-INTEL-I5-12400F",
          name: "Intel Core i5 12400F",
          brand: "Intel",
          category: "CPU",
          quantity: 20,
          unitPrice: 3200000,
        },
        idempotencyKey: `seed-row-key-1-2`,
        processedAt: importJob1.completedAt,
      },
      {
        importJobId: importJob1.id,
        rowNumber: 3,
        sku: "RAM-KING-8-DDR4",
        validationStatus: ImportRowStatus.COMMITTED,
        rawData: {
          sku: "RAM-KING-8-DDR4",
          name: "Kingston Fury Beast 8GB DDR4",
          brand: "Kingston",
          category: "RAM",
          quantity: 50,
          unit_price: 550000,
        },
        normalizedData: {
          sku: "RAM-KING-8-DDR4",
          name: "Kingston Fury Beast 8GB DDR4",
          brand: "Kingston",
          category: "RAM",
          quantity: 50,
          unitPrice: 550000,
        },
        idempotencyKey: `seed-row-key-1-3`,
        processedAt: importJob1.completedAt,
      },
      {
        importJobId: importJob1.id,
        rowNumber: 4,
        sku: "SSD-SAM-980-1TB",
        validationStatus: ImportRowStatus.COMMITTED,
        rawData: {
          sku: "SSD-SAM-980-1TB",
          name: "Samsung 980 1TB",
          brand: "Samsung",
          category: "SSD",
          quantity: 30,
          unit_price: 1690000,
        },
        normalizedData: {
          sku: "SSD-SAM-980-1TB",
          name: "Samsung 980 1TB",
          brand: "Samsung",
          category: "SSD",
          quantity: 30,
          unitPrice: 1690000,
        },
        idempotencyKey: `seed-row-key-1-4`,
        processedAt: importJob1.completedAt,
      },
    ],
  });

  // Import Job 2: Partial preview with validation errors
  const importJob2 = await prisma.importJob.create({
    data: {
      branchId: branchHCM.id,
      fileName: "Danh_Sach_Hang_Can_Kiem_Tra.xlsx",
      status: ImportStatus.PREVIEW_READY,
      totalRows: 3,
      processedRows: 3,
      validRows: 2,
      invalidRows: 1,
      committedRows: 0,
      createdBy: userManagerHCM.id,
      createdAt: new Date(),
    },
  });

  // Seed rows for Import Job 2
  await prisma.importJobRow.createMany({
    data: [
      {
        importJobId: importJob2.id,
        rowNumber: 2,
        sku: "RAM-KING-8-DDR4",
        validationStatus: ImportRowStatus.VALID,
        rawData: {
          sku: "RAM-KING-8-DDR4",
          name: "Kingston Fury Beast 8GB DDR4",
          brand: "Kingston",
          category: "RAM",
          quantity: 15,
          unit_price: 550000,
          ddr_generation: "DDR4",
          speed_mhz: 3200,
          capacity_gb: 8,
        },
        normalizedData: {
          sku: "RAM-KING-8-DDR4",
          name: "Kingston Fury Beast 8GB DDR4",
          brand: "Kingston",
          category: "RAM",
          quantity: 15,
          unitPrice: 550000,
          ddrGeneration: "DDR4",
          speedMhz: 3200,
          capacityGb: 8,
        },
        idempotencyKey: `seed-row-key-2-2`,
      },
      {
        importJobId: importJob2.id,
        rowNumber: 3,
        sku: "INVALID-RAM-ROW",
        validationStatus: ImportRowStatus.INVALID,
        errorMessage:
          "ddrGeneration: Required; speedMhz: Required; capacityGb: Required (Category RAM requires spec fields)",
        rawData: {
          sku: "INVALID-RAM-ROW",
          name: "Ram non-spec test",
          brand: "Generic",
          category: "RAM",
          quantity: 10,
          unit_price: 400000,
        },
        idempotencyKey: `seed-row-key-2-3`,
      },
      {
        importJobId: importJob2.id,
        rowNumber: 4,
        sku: "GPU-ASUS-4070-12G",
        validationStatus: ImportRowStatus.VALID,
        rawData: {
          sku: "GPU-ASUS-4070-12G",
          name: "ASUS ROG Strix RTX 4070",
          brand: "ASUS",
          category: "GPU",
          quantity: 5,
          unit_price: 19800000,
          vram_gb: 12,
        },
        normalizedData: {
          sku: "GPU-ASUS-4070-12G",
          name: "ASUS ROG Strix RTX 4070",
          brand: "ASUS",
          category: "GPU",
          quantity: 5,
          unitPrice: 19800000,
          vramGb: 12,
        },
        idempotencyKey: `seed-row-key-2-4`,
      },
    ],
  });

  console.log(
    "🚀 Seeding completed successfully! System has been populated with rich sample data.",
  );
  console.log("\n🔑 Test User Credentials:");
  console.log("----------------------------------------------------------------------------------");
  console.log("1. ADMIN:            duyanh19122k3+admin@gmail.com       / Password: 123");
  console.log("2. STORE_MANAGER HN:  duyanh19122k3+manager_hn@gmail.com  / Password: 123");
  console.log("3. STORE_MANAGER HCM: duyanh19122k3+manager_hcm@gmail.com / Password: 123");
  console.log("4. WAREHOUSE:         duyanh19122k3+warehouse@gmail.com   / Password: 123");
  console.log("----------------------------------------------------------------------------------");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("❌ Seeding failed with error:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
