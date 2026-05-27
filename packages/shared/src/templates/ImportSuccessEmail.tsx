// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { jsx } from "./jsx-runtime";

export interface ImportSuccessEmailProps {
  uploaderName: string;
  fileName: string;
  branchCode: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  committedRows: number;
  completedAt: string;
  dashboardUrl: string;
}

export function ImportSuccessEmail(props: ImportSuccessEmailProps): string {
  const hasWarnings = props.invalidRows > 0;

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
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
          overflow: "hidden",
          border: "1px solid #e5e7eb",
        }}
      >
        {/* Header Hero Section */}
        <div style={{ backgroundColor: "#059669", padding: "32px 24px", textAlign: "center" }}>
          <div
            style={{
              display: "inline-block",
              backgroundColor: "rgba(255, 255, 255, 0.15)",
              borderRadius: "50%",
              padding: "12px",
              marginBottom: "16px",
            }}
          >
            <span style={{ fontSize: "28px", color: "#ffffff", lineHeight: "1" }}>✅</span>
          </div>
          <h1
            style={{
              color: "#ffffff",
              margin: 0,
              fontSize: "24px",
              fontWeight: "700",
              letterSpacing: "-0.025em",
            }}
          >
            Import Completed Successfully!
          </h1>
          <p style={{ color: "#d1fae5", margin: "8px 0 0 0", fontSize: "14px" }}>
            Your inventory data has been verified and committed.
          </p>
        </div>

        {/* Card Body */}
        <div style={{ padding: "32px 24px" }}>
          <p
            style={{ fontSize: "16px", lineHeight: "1.6", margin: "0 0 24px 0", color: "#374151" }}
          >
            Hi <strong>{props.uploaderName}</strong>,
          </p>
          <p
            style={{ fontSize: "15px", lineHeight: "1.6", margin: "0 0 24px 0", color: "#4b5563" }}
          >
            The spreadsheet <code>{props.fileName}</code> was successfully processed and committed
            to branch <strong>{props.branchCode}</strong>. Below is the final data breakdown:
          </p>

          {/* Warning Banner for Partial Success */}
          {hasWarnings ? (
            <div
              style={{
                backgroundColor: "#fffbeb",
                borderLeft: "4px solid #f59e0b",
                padding: "16px",
                borderRadius: "8px",
                marginBottom: "24px",
              }}
            >
              <div style={{ display: "flex" }}>
                <span style={{ fontSize: "18px", marginRight: "8px" }}>⚠️</span>
                <div>
                  <h4 style={{ margin: 0, color: "#92400e", fontSize: "14px", fontWeight: "600" }}>
                    Partial Success Warning
                  </h4>
                  <p
                    style={{
                      margin: "4px 0 0 0",
                      color: "#b45309",
                      fontSize: "13px",
                      lineHeight: "1.5",
                    }}
                  >
                    <strong>{props.invalidRows} rows</strong> failed validation checks and were
                    skipped. You can download the validation error log on the dashboard.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Metrics Grid */}
          <div
            style={{
              backgroundColor: "#f9fafb",
              borderRadius: "12px",
              border: "1px solid #f3f4f6",
              padding: "20px",
              marginBottom: "32px",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "12px 0", color: "#6b7280", fontSize: "14px" }}>
                    File Name
                  </td>
                  <td
                    style={{
                      padding: "12px 0",
                      textAlign: "right",
                      color: "#111827",
                      fontWeight: "600",
                      fontSize: "14px",
                    }}
                  >
                    {props.fileName}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "12px 0", color: "#6b7280", fontSize: "14px" }}>
                    Target Branch
                  </td>
                  <td
                    style={{
                      padding: "12px 0",
                      textAlign: "right",
                      color: "#111827",
                      fontWeight: "600",
                      fontSize: "14px",
                    }}
                  >
                    <code>{props.branchCode}</code>
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "12px 0", color: "#6b7280", fontSize: "14px" }}>
                    Total Rows Found
                  </td>
                  <td
                    style={{
                      padding: "12px 0",
                      textAlign: "right",
                      color: "#111827",
                      fontWeight: "600",
                      fontSize: "14px",
                    }}
                  >
                    {props.totalRows}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td
                    style={{
                      padding: "12px 0",
                      color: "#10b981",
                      fontSize: "14px",
                      fontWeight: "500",
                    }}
                  >
                    Valid Rows Approved
                  </td>
                  <td
                    style={{
                      padding: "12px 0",
                      textAlign: "right",
                      color: "#10b981",
                      fontWeight: "600",
                      fontSize: "14px",
                    }}
                  >
                    {props.validRows}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td
                    style={{
                      padding: "12px 0",
                      color: props.invalidRows > 0 ? "#ef4444" : "#6b7280",
                      fontSize: "14px",
                      fontWeight: "500",
                    }}
                  >
                    Invalid Rows Skipped
                  </td>
                  <td
                    style={{
                      padding: "12px 0",
                      textAlign: "right",
                      color: props.invalidRows > 0 ? "#ef4444" : "#111827",
                      fontWeight: "600",
                      fontSize: "14px",
                    }}
                  >
                    {props.invalidRows}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "12px 0 0 0",
                      color: "#3b82f6",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    Committed to Inventory
                  </td>
                  <td
                    style={{
                      padding: "12px 0 0 0",
                      textAlign: "right",
                      color: "#3b82f6",
                      fontWeight: "700",
                      fontSize: "15px",
                    }}
                  >
                    {props.committedRows}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* CTA Action Button */}
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <a
              href={props.dashboardUrl}
              target="_blank"
              style={{
                display: "inline-block",
                backgroundColor: "#3b82f6",
                color: "#ffffff",
                padding: "14px 32px",
                fontSize: "15px",
                fontWeight: "600",
                textDecoration: "none",
                borderRadius: "8px",
                boxShadow: "0 2px 4px rgba(59, 130, 246, 0.2)",
                transition: "all 0.15s ease",
              }}
            >
              Open Inventory Dashboard
            </a>
          </div>

          <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: "24px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af" }}>
              Completed processing at {props.completedAt}
            </p>
          </div>
        </div>

        {/* Footer Area */}
        <div
          style={{
            backgroundColor: "#f9fafb",
            padding: "24px",
            textAlign: "center",
            borderTop: "1px solid #e5e7eb",
          }}
        >
          <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af", lineHeight: "1.5" }}>
            This is an automated notification from StockFlow Cloud Platform.
            <br />
            Please do not reply directly to this email.
          </p>
        </div>
      </div>
    </div>
  );
}
