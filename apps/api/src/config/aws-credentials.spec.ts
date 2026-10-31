import { staticAwsCredentials } from "./aws-credentials";
import { EnvService } from "./env.service";

function envWith(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] } as unknown as EnvService;
}

describe("staticAwsCredentials", () => {
  const original = process.env.AWS_LAMBDA_FUNCTION_NAME;

  afterEach(() => {
    if (original === undefined) delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    else process.env.AWS_LAMBDA_FUNCTION_NAME = original;
  });

  it("returns undefined on Lambda so the SDK refreshes the runtime credentials", () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = "stockflow-api";
    const env = envWith({ AWS_ACCESS_KEY_ID: "ASIAEXAMPLE", AWS_SECRET_ACCESS_KEY: "secret" });

    expect(staticAwsCredentials(env)).toBeUndefined();
  });

  it("returns the configured key pair outside Lambda", () => {
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    const env = envWith({ AWS_ACCESS_KEY_ID: "minio", AWS_SECRET_ACCESS_KEY: "minio-secret" });

    expect(staticAwsCredentials(env)).toEqual({
      accessKeyId: "minio",
      secretAccessKey: "minio-secret",
    });
  });

  it("returns undefined when no key pair is configured", () => {
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;

    expect(staticAwsCredentials(envWith({}))).toBeUndefined();
  });
});
