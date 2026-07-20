// The JSX transform uses this runtime helper even though the source import is
// not referenced directly by TypeScript's semantic analysis.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { jsx } from "./jsx-runtime";

export interface ReconciliationAlertEmailProps {
  uploaderName: string;
  issueId: string;
  branchId: string;
  branchCode: string;
  sku: string;
  difference: number;
  completedAt: string;
  dashboardUrl: string;
}

export function ReconciliationAlertEmail(props: ReconciliationAlertEmailProps): string {
  const direction = props.difference > 0 ? "higher" : "lower";

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
        <div style={{ backgroundColor: "#b45309", padding: "28px 24px", color: "#ffffff" }}>
          <h1 style={{ margin: 0, fontSize: "22px" }}>Inventory reconciliation alert</h1>
          <p style={{ margin: "8px 0 0", color: "#fef3c7" }}>A stock balance requires review.</p>
        </div>
        <div style={{ padding: "28px 24px" }}>
          <p style={{ lineHeight: "1.6" }}>
            Hi <strong>{props.uploaderName}</strong>, SKU <strong>{props.sku}</strong> at branch{" "}
            <strong>{props.branchCode}</strong> is {Math.abs(props.difference)} units {direction}{" "}
            than the expected balance.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", margin: "24px 0" }}>
            <tbody>
              <tr>
                <td style={{ padding: "10px 0", color: "#6b7280" }}>Issue ID</td>
                <td style={{ padding: "10px 0", textAlign: "right" }}>{props.issueId}</td>
              </tr>
              <tr>
                <td style={{ padding: "10px 0", color: "#6b7280" }}>Difference</td>
                <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 700 }}>
                  {props.difference}
                </td>
              </tr>
            </tbody>
          </table>
          <div style={{ textAlign: "center" }}>
            <a
              href={props.dashboardUrl}
              target="_blank"
              style={{
                display: "inline-block",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                padding: "12px 24px",
                borderRadius: "8px",
                textDecoration: "none",
              }}
            >
              Review reconciliation
            </a>
          </div>
          <p style={{ margin: "24px 0 0", fontSize: "12px", color: "#9ca3af" }}>
            Alert generated at {props.completedAt}.
          </p>
        </div>
      </div>
    </div>
  );
}
