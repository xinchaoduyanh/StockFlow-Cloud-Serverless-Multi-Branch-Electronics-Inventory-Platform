import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export const CORRELATION_ID_HEADER = "x-correlation-id";
export const CORRELATION_ID_ATTRIBUTE = "correlationId";

// Giá trị này đi vào log và message SQS nên chỉ nhận chuỗi ngắn, ký tự an toàn;
// header do client gửi lên không được tin.
const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export function resolveCorrelationId(candidate: unknown): string {
  if (typeof candidate === "string" && CORRELATION_ID_PATTERN.test(candidate)) {
    return candidate;
  }
  return randomUUID();
}

const correlationStorage = new AsyncLocalStorage<string>();

export function runWithCorrelationId<T>(correlationId: string, callback: () => T): T {
  return correlationStorage.run(correlationId, callback);
}

export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore();
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function parseJsonRecord(text: unknown): Record<string, unknown> | undefined {
  if (typeof text !== "string") return undefined;
  try {
    return asRecord(JSON.parse(text));
  } catch {
    return undefined;
  }
}

function firstSafeString(...candidates: unknown[]): string | undefined {
  return candidates.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && CORRELATION_ID_PATTERN.test(candidate),
  );
}

// Lần theo một lần import/report bằng ID nghiệp vụ: import bắt đầu từ sự kiện S3 nên
// không có correlationId do client gửi, importJobId chính là sợi chỉ nối các Lambda.
export function extractCorrelationId(event: unknown): string | undefined {
  const payload = asRecord(event);
  const record = asRecord((Array.isArray(payload?.Records) ? payload.Records : [])[0]);
  const body = parseJsonRecord(record?.body);
  const attribute = asRecord(asRecord(record?.messageAttributes)?.[CORRELATION_ID_ATTRIBUTE]);

  return firstSafeString(
    payload?.[CORRELATION_ID_ATTRIBUTE],
    payload?.importJobId,
    attribute?.stringValue,
    body?.[CORRELATION_ID_ATTRIBUTE],
    body?.exportJobId,
    body?.importJobId,
  );
}
