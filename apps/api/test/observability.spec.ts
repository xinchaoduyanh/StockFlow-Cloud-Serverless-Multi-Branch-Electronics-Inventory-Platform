import { createLogger, withObservability } from "@stockflow/shared/dist/logger";
import { extractCorrelationId } from "@stockflow/shared/dist/correlation";
import type { Context } from "aws-lambda";

describe("extractCorrelationId", () => {
  it("prefers an explicit correlationId over business IDs", () => {
    expect(extractCorrelationId({ correlationId: "abc-1", importJobId: "job-9" })).toBe("abc-1");
  });

  it("uses importJobId for Step Functions payloads that start from an S3 event", () => {
    expect(extractCorrelationId({ importJobId: "job-9", bucket: "b" })).toBe("job-9");
  });

  it("reads the SQS message attribute", () => {
    const event = {
      Records: [{ messageAttributes: { correlationId: { stringValue: "req-7" } }, body: "{}" }],
    };
    expect(extractCorrelationId(event)).toBe("req-7");
  });

  it("falls back to exportJobId in the SQS body", () => {
    const event = { Records: [{ body: JSON.stringify({ version: 1, exportJobId: "exp-3" }) }] };
    expect(extractCorrelationId(event)).toBe("exp-3");
  });

  it("ignores values that are unsafe to put in logs", () => {
    expect(extractCorrelationId({ correlationId: "bad id\nwith newline" })).toBeUndefined();
    expect(extractCorrelationId("not an object")).toBeUndefined();
    expect(extractCorrelationId({ Records: [{ body: "not json" }] })).toBeUndefined();
  });
});

describe("withObservability", () => {
  const context = { awsRequestId: "req-id-1", functionName: "fn" } as Context;

  it("rethrows handler errors so SQS and Step Functions still retry", async () => {
    const logger = createLogger("test");
    const errorLog = jest.spyOn(logger, "error").mockImplementation();
    const handler = withObservability(logger, async () => {
      throw new Error("boom");
    });

    await expect(handler({}, context)).rejects.toThrow("boom");
    expect(errorLog).toHaveBeenCalledWith("Lambda invocation failed", expect.any(Error));
  });

  it("falls back to the Lambda request ID when the event carries no correlation ID", async () => {
    const logger = createLogger("test");
    const append = jest.spyOn(logger, "appendKeys");
    const handler = withObservability(logger, async () => "ok");

    await expect(handler({}, context)).resolves.toBe("ok");
    expect(append).toHaveBeenCalledWith({ correlationId: "req-id-1" });
  });
});
