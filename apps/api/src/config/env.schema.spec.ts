import { envSchema } from "./env.schema";

describe("E3 recovery environment schema", () => {
  it("uses safe local defaults for recovery configuration", () => {
    const env = envSchema.parse({});

    expect(env.REPORT_DISPATCH_MODE).toBe("local");
    expect(env.REPORT_MAX_RECEIVE_COUNT).toBe(5);
    expect(env.REPORT_PROCESSING_LEASE_SECONDS).toBe(900);
    expect(env.IMPORT_APPROVAL_TIMEOUT_SECONDS).toBe(86400);
    expect(env.IMPORT_MAX_REPLAY_COUNT).toBe(3);
  });

  it("parses queue URLs and numeric operational overrides", () => {
    const env = envSchema.parse({
      REPORT_DISPATCH_MODE: "sqs",
      REPORT_QUEUE_URL: "https://sqs.ap-southeast-1.amazonaws.com/123456789012/report-jobs",
      REPORT_QUEUE_DLQ_URL: "https://sqs.ap-southeast-1.amazonaws.com/123456789012/report-jobs-dlq",
      IMPORT_RECOVERY_QUEUE_URL:
        "https://sqs.ap-southeast-1.amazonaws.com/123456789012/import-recovery",
      REPORT_MAX_RECEIVE_COUNT: "7",
      IMPORT_MAX_REPLAY_COUNT: "4",
    });

    expect(env.REPORT_DISPATCH_MODE).toBe("sqs");
    expect(env.REPORT_MAX_RECEIVE_COUNT).toBe(7);
    expect(env.IMPORT_MAX_REPLAY_COUNT).toBe(4);
  });
});
