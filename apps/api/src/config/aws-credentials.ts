import { EnvService } from "./env.service";

/**
 * Static credentials for local development only (for example MinIO).
 *
 * On Lambda the runtime puts short-lived AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN
 * in the environment. Passing the first two without the token, or caching them in a client that lives
 * across invocations, signs requests with a key S3 rejects (InvalidAccessKeyId). Returning undefined
 * lets the SDK's default provider chain resolve and refresh credentials itself.
 */
export function staticAwsCredentials(env: EnvService) {
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) return undefined;

  const accessKeyId = env.get("AWS_ACCESS_KEY_ID");
  const secretAccessKey = env.get("AWS_SECRET_ACCESS_KEY");
  return accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined;
}
