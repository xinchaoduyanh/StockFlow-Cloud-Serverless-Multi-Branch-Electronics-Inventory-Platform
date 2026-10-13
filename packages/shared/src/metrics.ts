import { Metrics, MetricUnit } from "@aws-lambda-powertools/metrics";

// Mỗi tổ hợp tên metric + dimension là một custom metric bị tính tiền ngoài free tier
// (10 metric), nên chỉ dùng các tên trong danh sách này và một dimension `service`.
export const BusinessMetric = {
  IMPORT_ROWS_COMMITTED: "ImportRowsCommitted",
  IMPORT_JOB_FAILED: "ImportJobFailed",
  IMPORT_DURATION_MS: "ImportDurationMs",
  REPORT_GENERATED: "ReportGenerated",
  TRANSFER_APPROVED: "TransferApproved",
  RECONCILIATION_MISMATCH: "ReconciliationMismatch",
} as const;
export type BusinessMetric = (typeof BusinessMetric)[keyof typeof BusinessMetric];

export const METRICS_NAMESPACE = "StockFlow";

export { MetricUnit };

type MetricUnitName = (typeof MetricUnit)[keyof typeof MetricUnit];

export type MetricEmitter = (name: BusinessMetric, unit: MetricUnitName, value: number) => void;

// Ghi EMF ngay khi gọi (một dòng log mỗi lần) thay vì gom đến cuối invoke: tránh phải nhớ
// flush ở mọi đường thoát, và API NestJS không có "cuối invoke" rõ ràng.
export function createMetricEmitter(serviceName: string): MetricEmitter {
  const metrics = new Metrics({ namespace: METRICS_NAMESPACE, serviceName });
  return (name, unit, value) => {
    metrics.addMetric(name, unit, value);
    metrics.publishStoredMetrics();
  };
}
