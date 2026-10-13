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
