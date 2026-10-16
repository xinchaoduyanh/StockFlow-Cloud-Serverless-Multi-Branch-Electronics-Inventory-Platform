import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

type ParameterReader = (name: string) => Promise<string | undefined>;

// Lambda không nhận secret qua biến môi trường để nó không hiện trên console và không nằm trong
// state của function; nó chỉ nhận tên SSM parameter trong biến `<TÊN>_SSM_PARAMETER`.
export async function resolveSecretFromSsm(
  env: NodeJS.ProcessEnv,
  name: string,
  readParameter: ParameterReader,
): Promise<void> {
  if (env[name]) return;

  const parameterName = env[`${name}_SSM_PARAMETER`];
  if (!parameterName) return;

  const value = await readParameter(parameterName);
  if (!value) {
    throw new Error(`SSM parameter ${parameterName} is missing or empty`);
  }
  env[name] = value;
}

export function resolveDatabaseUrl(
  env: NodeJS.ProcessEnv,
  readParameter: ParameterReader,
): Promise<void> {
  return resolveSecretFromSsm(env, "DATABASE_URL", readParameter);
}

const readSsmParameter: ParameterReader = async (name) => {
  const client = new SSMClient({});
  const result = await client.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
  return result.Parameter?.Value;
};

let pending: Promise<void> | undefined;

// Chỉ gọi SSM một lần mỗi cold start. Prisma chụp DATABASE_URL ngay lúc `new PrismaClient()`
// (engine được tạo ở đó), nên client chỉ được tạo SAU khi hàm này xong. Tạo client ở mức module
// thì engine chụp env khi chưa có URL và mọi query sau đó fail "Environment variable not found".
export function ensureDatabaseUrl(): Promise<void> {
  pending ??= resolveDatabaseUrl(process.env, readSsmParameter).catch((error: unknown) => {
    pending = undefined; // lỗi tạm thời (throttle, mạng) thì lần invoke sau thử lại
    throw error;
  });
  return pending;
}

// Chỉ API dùng Pusher; Lambda worker không gọi hàm này.
export async function ensurePusherSecret(): Promise<void> {
  await resolveSecretFromSsm(process.env, "PUSHER_SECRET", readSsmParameter);
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
