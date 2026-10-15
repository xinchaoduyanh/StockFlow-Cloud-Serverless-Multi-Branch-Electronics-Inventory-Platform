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

// Chỉ gọi SSM một lần mỗi cold start. Prisma chụp DATABASE_URL ngay lúc `new PrismaClient()`
// (engine được tạo ở đó), nên client chỉ được tạo SAU khi hàm này xong. Tạo client ở mức module
// thì engine chụp env khi chưa có URL và mọi query sau đó fail "Environment variable not found".
export function ensureDatabaseUrl(): Promise<void> {
  pending ??= resolveDatabaseUrl(process.env, readSsmParameter)
    .then(logDatabaseUrlState)
    .catch((error: unknown) => {
      pending = undefined; // lỗi tạm thời (throttle, mạng) thì lần invoke sau thử lại
      throw error;
    });
  return pending;
}

// `onReady` chạy sau khi DATABASE_URL đã có và trước handler; chỗ để tạo PrismaClient.
export function withDatabaseUrl<TArgs extends unknown[], TResult>(
  handler: (...args: TArgs) => Promise<TResult>,
  onReady?: () => void,
): (...args: TArgs) => Promise<TResult> {
  return async (...args) => {
    await ensureDatabaseUrl();
    onReady?.();
    return handler(...args);
  };
}
