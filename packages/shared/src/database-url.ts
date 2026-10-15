import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { createLogger } from "./logger";

type ParameterReader = (name: string) => Promise<string | undefined>;

// Lambda không nhận DATABASE_URL qua biến môi trường để secret không hiện trên console
// và không nằm trong state của function; nó chỉ nhận tên SSM parameter.
export async function resolveDatabaseUrl(
  env: NodeJS.ProcessEnv,
  readParameter: ParameterReader,
): Promise<void> {
  if (env.DATABASE_URL) return;

  const parameterName = env.DATABASE_URL_SSM_PARAMETER;
  if (!parameterName) return;

  const value = await readParameter(parameterName);
  if (!value) {
    throw new Error(`SSM parameter ${parameterName} is missing or empty`);
  }
  env.DATABASE_URL = value;
}

const readSsmParameter: ParameterReader = async (name) => {
  const client = new SSMClient({});
  const result = await client.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
  return result.Parameter?.Value;
};

// TODO(P6 full-serverless): tạm thời, gỡ khi worker hết lỗi "Environment variable not found: DATABASE_URL".
// Chỉ ghi hình dạng của giá trị, không bao giờ ghi chính chuỗi kết nối.
function logDatabaseUrlState(): void {
  const url = process.env.DATABASE_URL;
  createLogger("database-url").info("DATABASE_URL state after resolve", {
    isSet: Boolean(url),
    length: url?.length ?? 0,
    scheme: url?.split("://")[0],
    ssmParameterSet: Boolean(process.env.DATABASE_URL_SSM_PARAMETER),
    arch: process.arch,
    engineLibrary: process.env.PRISMA_QUERY_ENGINE_LIBRARY,
  });
}

let pending: Promise<void> | undefined;

// Chỉ gọi SSM một lần mỗi cold start. Prisma đọc DATABASE_URL ở query đầu tiên chứ không phải
// lúc `new PrismaClient()`, nên chỉ cần gọi hàm này trước khi handler chạm tới DB.
export function ensureDatabaseUrl(): Promise<void> {
  pending ??= resolveDatabaseUrl(process.env, readSsmParameter)
    .then(logDatabaseUrlState)
    .catch((error: unknown) => {
      pending = undefined; // lỗi tạm thời (throttle, mạng) thì lần invoke sau thử lại
      throw error;
    });
  return pending;
}

export function withDatabaseUrl<TArgs extends unknown[], TResult>(
  handler: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  return async (...args) => {
    await ensureDatabaseUrl();
    return handler(...args);
  };
}
