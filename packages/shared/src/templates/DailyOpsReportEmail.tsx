// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { jsx } from "./jsx-runtime";
import {
  OPS_STATUS_LABEL,
  OpsStatus,
  escapeHtml,
  formatCount,
  formatLatency,
  formatUsd,
  type OpsReportData,
} from "../ops-report";

export interface DailyOpsReportEmailProps {
  status: OpsStatus;
  reportDate: string;
  data: OpsReportData;
}

const STATUS_COLOR: Record<OpsStatus, string> = {
  OK: "#15803d",
  ATTENTION: "#b45309",
  INCIDENT: "#b91c1c",
};

const UNAVAILABLE = "Không lấy được dữ liệu";

function row(label: string, value: string): string {
  return (
    <tr>
      <td style={{ padding: "8px 0", color: "#6b7280" }}>{label}</td>
      <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 600 }}>{value}</td>
    </tr>
  );
}

function section(title: string, rows: string[] | null): string {
  return (
    <div style={{ marginTop: "24px" }}>
      <h2 style={{ margin: "0 0 8px", fontSize: "15px", color: "#111827" }}>{title}</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>{rows ?? row(UNAVAILABLE, "-")}</tbody>
      </table>
    </div>
  );
}

function apiRows(data: OpsReportData): string[] | null {
  const api = data.api;
  if (!api) return null;
  return [
    row(
      "Tổng request",
      `${formatCount(api.requests)} (hôm trước: ${formatCount(api.previousRequests)})`,
    ),
    row("Lỗi 4xx / 5xx", `${formatCount(api.clientErrors)} / ${formatCount(api.serverErrors)}`),
    row(
      "Độ trễ p50 / p95",
      `${formatLatency(api.latencyP50Ms)} / ${formatLatency(api.latencyP95Ms)}`,
    ),
  ];
}

function endpointRows(data: OpsReportData): string[] | null {
  if (!data.topEndpoints) return null;
  if (data.topEndpoints.length === 0) return [row("Không có request", "-")];
  return data.topEndpoints.map((endpoint) =>
    row(escapeHtml(endpoint.route), formatCount(endpoint.hits)),
  );
}

function lambdaRows(data: OpsReportData): string[] | null {
  const lambda = data.lambda;
  if (!lambda) return null;
  const failing = lambda.errorsByFunction.filter((entry) => entry.errors > 0);
  const errorRows =
    failing.length === 0
      ? [row("Lambda lỗi", "0")]
      : failing.map((entry) => row(`Lỗi: ${escapeHtml(entry.name)}`, formatCount(entry.errors)));
  return [
    ...errorRows,
    row("Lambda api bị throttle", formatCount(lambda.throttles)),
    row(
      "Cold start (API)",
      `${formatCount(lambda.coldStarts)} lần, trung bình ${formatLatency(lambda.avgColdStartMs)}`,
    ),
  ];
}

function queueRows(data: OpsReportData): string[] | null {
  if (!data.deadLetterQueues) return null;
  return data.deadLetterQueues.map((queue) =>
    row(escapeHtml(queue.name), formatCount(queue.depth)),
  );
}

function alarmRows(data: OpsReportData): string[] | null {
  if (!data.alarmsInAlarm) return null;
  if (data.alarmsInAlarm.length === 0) return [row("Alarm đang ALARM", "không có")];
  return data.alarmsInAlarm.map((name) => row(escapeHtml(name), "ALARM"));
}

function businessRows(data: OpsReportData): string[] | null {
  const business = data.business;
  if (!business) return null;
  return [
    row(
      "Import hoàn tất / lỗi",
      `${formatCount(business.importsCompleted)} / ${formatCount(business.importsFailed)}`,
    ),
    row("Dòng đã ghi", formatCount(business.importRowsCommitted)),
    row("Report đã xuất", formatCount(business.reportsExported)),
    row("Transfer đã duyệt", formatCount(business.transfersApproved)),
  ];
}

export function DailyOpsReportEmail(props: DailyOpsReportEmailProps): string {
  const { data } = props;

  return (
    <div
      style={{
        fontFamily: "'Inter', 'Segoe UI', Helvetica, Arial, sans-serif",
        backgroundColor: "#f3f4f6",
        padding: "40px 20px",
        color: "#1f2937",
      }}
    >
      <div
        style={{
          maxWidth: "600px",
          margin: "0 auto",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          overflow: "hidden",
          border: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            backgroundColor: STATUS_COLOR[props.status],
            padding: "28px 24px",
            color: "#ffffff",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "22px" }}>{OPS_STATUS_LABEL[props.status]}</h1>
          <p style={{ margin: "8px 0 0" }}>
            Báo cáo vận hành StockFlow, 24 giờ trước {props.reportDate}
          </p>
        </div>
        <div style={{ padding: "8px 24px 28px" }}>
          {section("Traffic API", apiRows(data))}
          {section("Endpoint nhiều request nhất", endpointRows(data))}
          {section("Lambda", lambdaRows(data))}
          {section("Message đang nằm trong DLQ", queueRows(data))}
          {section("Alarm", alarmRows(data))}
          {section("Nghiệp vụ", businessRows(data))}
          {section("Chi phí", [
            row("AWS tháng này (ước tính)", formatUsd(data.estimatedChargesUsd)),
          ])}
          <p style={{ margin: "24px 0 0", fontSize: "12px", color: "#9ca3af" }}>
            Khoảng thời gian: {data.periodStart} đến {data.periodEnd} (UTC).
          </p>
        </div>
      </div>
    </div>
  );
}
