import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { ReconciliationStatus } from "@stockflow/shared";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/app.setup";
import { PrismaService } from "../src/database/prisma.service";
import { JwtAuthGuard } from "../src/auth/jwt-auth.guard";

describe("Reconciliation (e2e)", () => {
  let app: INestApplication;

  const mockIssues = [
    {
      id: "6e2b5b3a-18e4-4dcd-97b7-6b22c7a52e0a",
      branchId: "b8c3bc05-b1a1-43ee-8cb5-e6a3c94ff24a",
      componentId: "8f8b8a78-2921-4f10-91a5-e6b7d5ee7d63",
      expectedQuantity: 10,
      actualQuantity: 15,
      difference: 5,
      status: ReconciliationStatus.OPEN,
      runId: "recon-sync-12345",
      detectedAt: new Date().toISOString(),
      resolvedAt: null,
      branch: { code: "BR1", name: "Branch 1" },
      component: { sku: "SKU-TEST-1", name: "Component 1" },
    },
  ];

  const mockPrismaService = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    reconciliationIssue: {
      findMany: jest.fn().mockResolvedValue(mockIssues),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue(mockIssues[0]),
      create: jest.fn().mockResolvedValue(mockIssues[0]),
      findFirst: jest.fn(),
    },
    inventory: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: "inv-1",
          branchId: "b8c3bc05-b1a1-43ee-8cb5-e6a3c94ff24a",
          componentId: "8f8b8a78-2921-4f10-91a5-e6b7d5ee7d63",
          quantity: 15,
          reservedQuantity: 0,
          branch: { code: "BR1" },
          component: { sku: "SKU-TEST-1" },
        },
      ]),
    },
    stockMovement: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { quantityChange: 10 },
      }),
      create: jest.fn().mockResolvedValue({ id: "sm-1" }),
    },
    user: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { id: "admin-1", email: "admin@stockflow.com", role: "ADMIN", fullName: "Admin User" },
        ]),
      findUnique: jest.fn().mockResolvedValue({
        id: "admin-1",
        email: "admin@stockflow.com",
        role: "ADMIN",
        fullName: "Admin User",
      }),
    },
    notification: {
      create: jest.fn().mockResolvedValue({ id: "notif-1" }),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    // Reset mocks before each test
    jest.clearAllMocks();
    mockPrismaService.$transaction.mockImplementation((cb) => cb(mockPrismaService));
    mockPrismaService.reconciliationIssue.create.mockResolvedValue(mockIssues[0]);
    mockPrismaService.reconciliationIssue.update.mockResolvedValue(mockIssues[0]);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /api/reconciliation/issues", () => {
    it("should return a list of reconciliation issues", () => {
      return request(app.getHttpServer())
        .get("/api/reconciliation/issues")
        .expect(200)
        .expect((res) => {
          expect(res.body).toBeInstanceOf(Array);
          expect(res.body).toHaveLength(1);
          expect(res.body[0].id).toBe(mockIssues[0].id);
        });
    });
  });

  describe("POST /api/reconciliation/run", () => {
    it("should trigger reconciliation run and detect mismatch", async () => {
      // Setup finding first open issue to return null (create flow)
      mockPrismaService.reconciliationIssue.findFirst.mockResolvedValue(null);

      // We expect the local sync run to return completed with 1 mismatch
      return request(app.getHttpServer())
        .post("/api/reconciliation/run")
        .expect(201)
        .expect((res) => {
          expect(res.body.status).toBe("COMPLETED");
          expect(res.body.mismatches).toBe(1);
          expect(mockPrismaService.reconciliationIssue.create).toHaveBeenCalled();
          expect(mockPrismaService.notification.create).toHaveBeenCalled();
        });
    });
  });

  describe("POST /api/reconciliation/issues/:id/resolve", () => {
    it("should resolve a reconciliation issue and create stock movement", () => {
      const issueId = mockIssues[0].id;
      mockPrismaService.reconciliationIssue.findUnique.mockResolvedValue(mockIssues[0]);
      mockPrismaService.reconciliationIssue.update.mockResolvedValue({
        ...mockIssues[0],
        status: ReconciliationStatus.RESOLVED,
        resolvedAt: new Date().toISOString(),
      });

      return request(app.getHttpServer())
        .post(`/api/reconciliation/issues/${issueId}/resolve`)
        .expect(201)
        .expect((res) => {
          expect(res.body.status).toBe(ReconciliationStatus.RESOLVED);
          expect(mockPrismaService.stockMovement.create).toHaveBeenCalledWith({
            data: {
              branchId: mockIssues[0].branchId,
              componentId: mockIssues[0].componentId,
              quantityChange: mockIssues[0].difference,
              movementType: "RECONCILIATION_ADJUSTMENT",
              referenceType: "INVENTORY_ADJUSTMENT",
              referenceId: mockIssues[0].id,
            },
          });
        });
    });
  });
});
