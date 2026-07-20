import { ImportRowStatus, ImportStatus } from "@prisma/client";
import { ImportsService } from "./imports.service";
import { PrismaService } from "../database/prisma.service";
import { S3Service } from "./s3.service";
import { AuthorizationPolicyService } from "../auth/authorization-policy.service";

describe("ImportsService lifecycle", () => {
  const authorization = new AuthorizationPolicyService();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("does not start a background polling timer when constructed", () => {
    const setTimeoutSpy = jest.spyOn(global, "setTimeout");
    const setIntervalSpy = jest.spyOn(global, "setInterval");
    const prisma = {} as unknown as PrismaService;
    const s3 = {} as unknown as S3Service;

    const service = new ImportsService(prisma, s3, authorization);

    expect((service as unknown as { onModuleInit?: unknown }).onModuleInit).toBeUndefined();
    expect((service as unknown as { runPollingLoop?: unknown }).runPollingLoop).toBeUndefined();
    expect(
      (service as unknown as { autoApprovePendingJobs?: unknown }).autoApprovePendingJobs,
    ).toBeUndefined();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it("requires an explicit confirm call for a preview-ready job", async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: "job-1",
      status: ImportStatus.UPLOADED,
      awsTaskToken: null,
    });
    const prisma = {
      importJob: { findUnique },
    } as unknown as PrismaService;
    const service = new ImportsService(prisma, {} as unknown as S3Service, authorization);

    await expect(service.confirm("job-1")).rejects.toMatchObject({
      message: expect.stringContaining("not ready to confirm"),
    });
    expect(findUnique).toHaveBeenCalledWith({ where: { id: "job-1" } });
  });

  it("claims a local preview job before committing rows", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const findMany = jest.fn().mockResolvedValue([]);
    const update = jest.fn().mockResolvedValue({
      id: "job-2",
      status: ImportStatus.COMPLETED,
      committedRows: 0,
    });
    const tx = {
      importJob: { updateMany, findMany, update },
      importJobRow: { findMany },
    };
    const prisma = {
      importJob: {
        findUnique: jest.fn().mockResolvedValue({
          id: "job-2",
          status: ImportStatus.PREVIEW_READY,
          awsTaskToken: null,
        }),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;

    await new ImportsService(prisma, {} as unknown as S3Service, authorization).confirm("job-2");

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "job-2",
        status: ImportStatus.PREVIEW_READY,
        awsTaskToken: null,
      },
      data: { status: ImportStatus.COMMITTING },
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { importJobId: "job-2", validationStatus: ImportRowStatus.VALID },
      orderBy: { rowNumber: "asc" },
    });
  });
});
