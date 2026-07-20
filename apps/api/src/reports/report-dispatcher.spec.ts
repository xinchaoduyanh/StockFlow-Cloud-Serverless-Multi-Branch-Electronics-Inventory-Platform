import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { EnvService } from "../config/env.service";
import { ReportDispatcher } from "./report-dispatcher";

describe("ReportDispatcher", () => {
  afterEach(() => jest.restoreAllMocks());

  it("publishes only the versioned report job contract", async () => {
    const send = jest.spyOn(SQSClient.prototype, "send").mockResolvedValue({} as never);
    const env = {
      get: jest.fn(
        (key: string) =>
          (
            ({
              AWS_REGION: "ap-southeast-1",
              REPORT_DISPATCH_MODE: "sqs",
              REPORT_QUEUE_URL: "https://sqs.example.test/report",
              NODE_ENV: "test",
            }) as Record<string, string>
          )[key],
      ),
    } as unknown as EnvService;

    await new ReportDispatcher(env).dispatch("11111111-1111-4111-8111-111111111111");

    const command = send.mock.calls[0][0] as SendMessageCommand;
    expect(command.input.QueueUrl).toBe("https://sqs.example.test/report");
    expect(JSON.parse(command.input.MessageBody ?? "{}")).toEqual({
      version: 1,
      exportJobId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("rejects local dispatch in production", async () => {
    const env = {
      get: jest.fn(
        (key: string) =>
          (
            ({
              AWS_REGION: "ap-southeast-1",
              REPORT_DISPATCH_MODE: "local",
              NODE_ENV: "production",
            }) as Record<string, string>
          )[key],
      ),
    } as unknown as EnvService;
    await expect(
      new ReportDispatcher(env).dispatch("11111111-1111-4111-8111-111111111111"),
    ).rejects.toThrow("disabled in production");
  });
});
