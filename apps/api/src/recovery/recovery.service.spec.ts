import {
  ImportRecoveryTerminalStatus,
  ImportRowStatus,
  ImportStatus,
  RecoveryItemStatus,
  UserRole,
} from "@prisma/client";
import { RecoveryService } from "./recovery.service";

describe("RecoveryService authorization boundary", () => {
  it("fails closed before reading recovery data for non-admin actors", async () => {
    const service = new RecoveryService(
      {} as never,
      { get: jest.fn(() => "ap-southeast-1") } as never,
      {
        assertAdmin: jest.fn(() => {
          throw new Error("admin required");
        }),
      } as never,
      {} as never,
    );
    await expect(
      service.listReports(
        { page: 1, limit: 20 },
        { role: UserRole.STORE_MANAGER, branchId: "branch", sub: "user" },
      ),
    ).rejects.toThrow("admin required");
  });

  it("reopens only failed rows and preserves committed inventory during replay", async () => {
    const item = {
      id: "22222222-2222-4222-8222-222222222222",
      importJobId: "11111111-1111-4111-8111-111111111111",
      status: RecoveryItemStatus.OPEN,
      terminalStatus: ImportRecoveryTerminalStatus.FAILED,
      replayCount: 0,
    };
    const job = {
      id: item.importJobId,
      s3Key: `imports/branch/${item.importJobId}-inventory.xlsx`,
      committedRows: 12,
    };
    const tx = {
      importRecoveryItem: {
        findUnique: jest.fn().mockResolvedValue(item),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...item,
          status: RecoveryItemStatus.REPLAYING,
          replayCount: 1,
        }),
      },
      importJob: {
        findUnique: jest.fn().mockResolvedValue(job),
        update: jest.fn().mockResolvedValue(job),
      },
      importJobRow: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      importJob: {
        update: jest.fn().mockResolvedValue(job),
      },
      importRecoveryItem: {
        findUnique: jest.fn().mockResolvedValue({
          ...item,
          status: RecoveryItemStatus.REPLAYING,
          replayCount: 1,
        }),
      },
    };
    const envValues: Record<string, string> = {
      AWS_REGION: "ap-southeast-1",
      AWS_S3_BUCKET: "stockflow-imports",
      IMPORT_MAX_REPLAY_COUNT: "3",
      IMPORT_STATE_MACHINE_ARN: "arn:aws:states:ap-southeast-1:123456789012:stateMachine:stockflow",
    };
    const service = new RecoveryService(
      prisma as never,
      { get: jest.fn((key: string) => envValues[key]) } as never,
      { assertAdmin: jest.fn() } as never,
      {} as never,
    );
    jest
      .spyOn((service as unknown as { sfn: { send: () => Promise<unknown> } }).sfn, "send")
      .mockResolvedValue({
        executionArn: "arn:aws:states:ap-southeast-1:123456789012:execution:stockflow:replay-1",
      });

    await service.replayImport(
      item.id,
      { reason: "Retry transient database failure" },
      {
        role: UserRole.ADMIN,
        branchId: null,
        sub: "33333333-3333-4333-8333-333333333333",
      },
    );

    expect(tx.importRecoveryItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: item.id,
          status: RecoveryItemStatus.OPEN,
          replayCount: { lt: 3 },
        },
      }),
    );
    expect(tx.importJobRow.updateMany).toHaveBeenCalledWith({
      where: {
        importJobId: job.id,
        validationStatus: ImportRowStatus.FAILED,
      },
      data: {
        validationStatus: ImportRowStatus.VALID,
        errorMessage: null,
        processedAt: null,
      },
    });
    expect(tx.importJob.update).toHaveBeenCalledWith({
      where: { id: job.id },
      data: {
        status: ImportStatus.UPLOADED,
        errorMessage: null,
        awsTaskToken: null,
        executionArn: null,
      },
    });
    expect(tx.importJob.update.mock.calls[0][0].data).not.toHaveProperty("committedRows");
  });

  it("rejects a replay when another operator wins the conditional claim", async () => {
    const tx = {
      importRecoveryItem: {
        findUnique: jest.fn().mockResolvedValue({
          id: "22222222-2222-4222-8222-222222222222",
          importJobId: "11111111-1111-4111-8111-111111111111",
          status: RecoveryItemStatus.OPEN,
          replayCount: 0,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      importJob: {
        findUnique: jest.fn().mockResolvedValue({
          id: "11111111-1111-4111-8111-111111111111",
        }),
      },
    };
    const service = new RecoveryService(
      {
        $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      } as never,
      {
        get: jest.fn(
          (key: string) =>
            (
              ({
                AWS_REGION: "ap-southeast-1",
                IMPORT_MAX_REPLAY_COUNT: "3",
              }) as Record<string, string>
            )[key],
        ),
      } as never,
      { assertAdmin: jest.fn() } as never,
      {} as never,
    );

    await expect(
      service.replayImport(
        "22222222-2222-4222-8222-222222222222",
        { reason: "Retry transient failure" },
        {
          role: UserRole.ADMIN,
          branchId: null,
          sub: "33333333-3333-4333-8333-333333333333",
        },
      ),
    ).rejects.toThrow("claimed by another operator");
  });
});

describe("RecoveryService list pagination", () => {
  const authorization = { assertAdmin: jest.fn() } as never;
  const env = { get: jest.fn(() => "ap-southeast-1") } as never;
  const admin = { role: UserRole.ADMIN, branchId: null, sub: "admin" };

  it("returns the total of failed report exports, not just the page", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(27);
    const service = new RecoveryService(
      { exportJob: { findMany, count } } as never,
      env,
      authorization,
      {} as never,
    );

    const page = await service.listReports({ page: 3, limit: 10 }, admin);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
    expect(count).toHaveBeenCalledWith({ where: findMany.mock.calls[0][0].where });
    expect(page).toEqual({ items: [], total: 27, page: 3, limit: 10 });
  });

  it("returns the total of import recovery items with the page", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(14);
    const service = new RecoveryService(
      { importRecoveryItem: { findMany, count } } as never,
      env,
      authorization,
      {} as never,
    );

    const page = await service.listImportRecovery({ page: 2, limit: 10 }, admin);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
    expect(page).toEqual({ items: [], total: 14, page: 2, limit: 10 });
  });
});
