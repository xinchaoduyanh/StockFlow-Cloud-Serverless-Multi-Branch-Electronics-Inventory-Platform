import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/app.setup";
import { PrismaService } from "../src/database/prisma.service";

describe("AppController (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("/api/health (GET)", () => {
    return request(app.getHttpServer())
      .get("/api/health")
      .expect(200)
      .expect({
        service: "stockflow-api",
        status: "ok",
      });
  });

  it("wraps route errors with the API error envelope", () => {
    return request(app.getHttpServer())
      .get("/api/not-found")
      .expect(404)
      .expect((response) => {
        expect(response.body).toMatchObject({
          success: false,
          statusCode: 404,
          path: "/api/not-found",
          error: {
            code: "NOT_FOUND",
            message: "Cannot GET /api/not-found",
          },
        });
        expect(response.body.timestamp).toEqual(expect.any(String));
      });
  });
});
