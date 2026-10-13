import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from "aws-lambda";
import { handler } from "../src/lambda";

function httpApiEvent(path: string): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "$default",
    rawPath: path,
    rawQueryString: "",
    headers: { host: "api.test", "content-type": "application/json" },
    requestContext: {
      accountId: "000000000000",
      apiId: "test",
      domainName: "api.test",
      domainPrefix: "api",
      http: {
        method: "GET",
        path,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "jest",
      },
      requestId: "request-id",
      routeKey: "$default",
      stage: "$default",
      time: "01/Jan/2026:00:00:00 +0000",
      timeEpoch: 0,
    },
    isBase64Encoded: false,
  };
}

// Bắt lỗi DI/metadata của NestJS ở CI thay vì phát hiện sau khi đã lên AWS.
describe("API Lambda handler", () => {
  it("serves /api/health through an HTTP API v2 event", async () => {
    const result = (await handler(
      httpApiEvent("/api/health"),
      {} as Context,
      () => undefined,
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(String(result.body))).toMatchObject({
      service: "stockflow-api",
      status: "ok",
    });
  });
});
