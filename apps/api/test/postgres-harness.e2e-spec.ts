import {
  ImportRecoveryTerminalStatus,
  ImportStatus,
  PrismaClient,
  ReportType,
  RecoveryItemStatus,
  UserRole,
} from "@prisma/client";

const describePostgres = process.env.RUN_POSTGRES_TESTS === "1" ? describe : describe.skip;

describePostgres("PostgreSQL integration harness", () => {
  const prisma = new PrismaClient();
  let branchId: string;
  let componentId: string;
  let secondComponentId: string;
  let userId: string;

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "audit_logs", "import_recovery_items", "notifications", "export_jobs", "reconciliation_issues", "stock_movements", "transfer_items", "transfers", "import_job_rows", "import_jobs", "inventory", "components", "users", "branches" CASCADE`,
    );

    const branch = await prisma.branch.create({
      data: { code: "HARNESS", name: "Harness Branch" },
    });
    const component = await prisma.component.create({
      data: { sku: "HARNESS-SKU", name: "Harness Component", category: "CPU" },
    });
    const secondComponent = await prisma.component.create({
      data: { sku: "HARNESS-SKU-2", name: "Harness Component 2", category: "RAM" },
    });

    branchId = branch.id;
    const user = await prisma.user.create({
      data: {
        email: "harness@example.com",
        role: UserRole.ADMIN,
        branchId,
      },
    });
    userId = user.id;
    componentId = component.id;
    secondComponentId = secondComponent.id;
    await prisma.inventory.create({
      data: { branchId, componentId, quantity: 10, reservedQuantity: 0 },
    });
    await prisma.inventory.create({
      data: { branchId, componentId: secondComponentId, quantity: 7, reservedQuantity: 0 },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("runs migrations and creates isolated branch/component fixtures", async () => {
    const inventory = await prisma.inventory.findUnique({
      where: { branchId_componentId: { branchId, componentId } },
    });

    expect(inventory).toMatchObject({ quantity: 10, reservedQuantity: 0 });
  });

  it("rolls back a failed transaction without leaking a partial update", async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.inventory.update({
          where: { branchId_componentId: { branchId, componentId } },
          data: { quantity: 3 },
        });
        await tx.inventory.update({
          where: { branchId_componentId: { branchId, componentId: secondComponentId } },
          data: { quantity: 1 },
        });
        throw new Error("intentional rollback");
      }),
    ).rejects.toThrow("intentional rollback");

    const inventory = await prisma.inventory.findUnique({
      where: { branchId_componentId: { branchId, componentId } },
    });
    expect(inventory?.quantity).toBe(10);
    const secondInventory = await prisma.inventory.findUnique({
      where: { branchId_componentId: { branchId, componentId: secondComponentId } },
    });
    expect(secondInventory?.quantity).toBe(7);
  });

  it("allows only one concurrent reservation to consume the final available units", async () => {
    const firstClient = new PrismaClient();
    const secondClient = new PrismaClient();
    await Promise.all([firstClient.$connect(), secondClient.$connect()]);

    const reserve = (client: PrismaClient) =>
      client.$executeRaw`
        UPDATE "inventory"
        SET "reserved_quantity" = "reserved_quantity" + 6,
            "version" = "version" + 1,
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "branch_id" = ${branchId}::uuid
          AND "component_id" = ${componentId}::uuid
          AND "quantity" - "reserved_quantity" >= 6
      `;

    try {
      const results = await Promise.all([reserve(firstClient), reserve(secondClient)]);
      expect(results.sort()).toEqual([0, 1]);

      const inventory = await prisma.inventory.findUnique({
        where: { branchId_componentId: { branchId, componentId } },
      });
      expect(inventory?.reservedQuantity).toBe(6);
    } finally {
      await Promise.all([firstClient.$disconnect(), secondClient.$disconnect()]);
    }
  });

  it("rejects inventory rows that violate database CHECK constraints", async () => {
    await expect(
      prisma.inventory.update({
        where: { branchId_componentId: { branchId, componentId } },
        data: { quantity: -1 },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.inventory.update({
        where: { branchId_componentId: { branchId, componentId } },
        data: { reservedQuantity: 11 },
      }),
    ).rejects.toThrow();
  });

  it("enforces unique import execution correlation for recovery events", async () => {
    const firstJob = await prisma.importJob.create({
      data: {
        branchId,
        status: ImportStatus.FAILED,
        executionArn:
          "arn:aws:states:ap-southeast-1:123456789012:execution:stockflow-ingestion:run-1",
      },
    });
    const secondJob = await prisma.importJob.create({
      data: { branchId, status: ImportStatus.FAILED },
    });

    await prisma.importRecoveryItem.create({
      data: {
        importJobId: firstJob.id,
        executionArn: firstJob.executionArn,
        terminalStatus: ImportRecoveryTerminalStatus.FAILED,
        status: RecoveryItemStatus.OPEN,
      },
    });

    await expect(
      prisma.importRecoveryItem.create({
        data: {
          importJobId: secondJob.id,
          executionArn: firstJob.executionArn,
          terminalStatus: ImportRecoveryTerminalStatus.FAILED,
        },
      }),
    ).rejects.toThrow();
  });

  it("deduplicates notifications by SNS source message ID", async () => {
    const notification = {
      userId,
      sourceMessageId: "sns-message-1",
      title: "Import failed",
      message: "A test import failed.",
      type: "IMPORT_FAILED",
    };

    await prisma.notification.create({ data: notification });
    await expect(prisma.notification.create({ data: notification })).rejects.toThrow();
  });

  it("persists report queue state with an updated timestamp", async () => {
    const exportJob = await prisma.exportJob.create({
      data: { reportType: ReportType.INVENTORY },
    });

    expect(exportJob.updatedAt).toBeInstanceOf(Date);
    expect(exportJob.attemptCount).toBe(0);
  });
});
