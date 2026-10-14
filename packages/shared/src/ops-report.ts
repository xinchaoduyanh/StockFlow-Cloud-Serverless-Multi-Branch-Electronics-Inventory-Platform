// Logic thuần của email báo cáo vận hành hằng ngày, tách khỏi Lambda để test không cần AWS.

export const OpsStatus = {
  OK: "OK",
  ATTENTION: "ATTENTION",
  INCIDENT: "INCIDENT",
} as const;
export type OpsStatus = (typeof OpsStatus)[keyof typeof OpsStatus];

export const OPS_STATUS_LABEL: Record<OpsStatus, string> = {
  OK: "Ổn",
  ATTENTION: "Cần xem",
  INCIDENT: "Có sự cố",
};

export const OPS_REPORT_WINDOW_HOURS = 24;

// Mỗi phần của báo cáo lấy từ một nguồn khác nhau; nguồn nào lỗi thì phần đó là `null`
// để email vẫn gửi được và người đọc biết chỗ nào thiếu.
export interface OpsApiSection {
  requests: number;
  previousRequests: number;
  clientErrors: number;
  serverErrors: number;
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
}

export interface OpsEndpointHit {
  route: string;
  hits: number;
}

export interface OpsLambdaSection {
  errorsByFunction: Array<{ name: string; errors: number }>;
  throttles: number;
  coldStarts: number;
  avgColdStartMs: number | null;
}

export interface OpsQueueDepth {
  name: string;
  depth: number;
}

export interface OpsBusinessSection {
  importsCompleted: number;
  importsFailed: number;
  importRowsCommitted: number;
  reportsExported: number;
  transfersApproved: number;
}

export interface OpsReportData {
  periodStart: string;
  periodEnd: string;
  api: OpsApiSection | null;
  topEndpoints: OpsEndpointHit[] | null;
  lambda: OpsLambdaSection | null;
  deadLetterQueues: OpsQueueDepth[] | null;
  alarmsInAlarm: string[] | null;
  business: OpsBusinessSection | null;
  estimatedChargesUsd: number | null;
}

export function computeOpsStatus(data: OpsReportData): OpsStatus {
  if (data.alarmsInAlarm && data.alarmsInAlarm.length > 0) return OpsStatus.INCIDENT;

  const hasServerErrors = (data.api?.serverErrors ?? 0) > 0;
  const hasDeadLetters = (data.deadLetterQueues ?? []).some((queue) => queue.depth > 0);
  if (hasServerErrors || hasDeadLetters) return OpsStatus.ATTENTION;

  // Thiếu dữ liệu ở phần quyết định trạng thái thì không thể báo "Ổn".
  const missingCriticalSection =
    data.api === null || data.deadLetterQueues === null || data.alarmsInAlarm === null;
  return missingCriticalSection ? OpsStatus.ATTENTION : OpsStatus.OK;
}

export function buildOpsReportSubject(status: OpsStatus, reportDate: string): string {
  return `[StockFlow] ${OPS_STATUS_LABEL[status]} - báo cáo vận hành ${reportDate}`;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

export function formatLatency(ms: number | null): string {
  if (ms === null) return "n/a";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1).replace(".", ",")} s` : `${Math.round(ms)} ms`;
}

export function formatUsd(amount: number | null): string {
  return amount === null ? "n/a" : `$${amount.toFixed(2)}`;
}

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const NUMERIC_SEGMENT_PATTERN = /\/\d+(?=\/|$)/g;

// Đường dẫn chứa ID làm mỗi request thành một dòng riêng; gộp về dạng `/:id` để xếp hạng được.
export function normalizeRoute(method: string, path: string): string {
  const normalizedPath = path.replace(UUID_PATTERN, ":id").replace(NUMERIC_SEGMENT_PATTERN, "/:id");
  return `${method} ${normalizedPath}`;
}

export function rankEndpoints(
  rows: Array<{ method: string; path: string; hits: number }>,
  limit: number,
): OpsEndpointHit[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const route = normalizeRoute(row.method, row.path);
    totals.set(route, (totals.get(route) ?? 0) + row.hits);
  }
  return [...totals.entries()]
    .map(([route, hits]) => ({ route, hits }))
    .sort((left, right) => right.hits - left.hits || left.route.localeCompare(right.route))
    .slice(0, limit);
}

// Đường dẫn trong access log do client gửi lên và jsx-runtime không tự escape,
// nên mọi chuỗi đến từ log phải qua đây trước khi vào email.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
