import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

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

let pending: Promise<void> | undefined;

// Chỉ gọi SSM một lần mỗi cold start. Prisma đọc DATABASE_URL ở query đầu tiên chứ không phải
// lúc `new PrismaClient()`, nên chỉ cần gọi hàm này trước khi handler chạm tới DB.
export function ensureDatabaseUrl(): Promise<void> {
  pending ??= resolveDatabaseUrl(process.env, readSsmParameter).catch((error: unknown) => {
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
