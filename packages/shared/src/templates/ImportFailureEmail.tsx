// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { jsx } from "./jsx-runtime";

export interface ImportFailureEmailProps {
  uploaderName: string;
  fileName: string;
  branchCode: string;
  errorMessage: string;
  completedAt: string;
  dashboardUrl: string;
}

export function ImportFailureEmail(props: ImportFailureEmailProps): string {
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
        <div style={{ backgroundColor: "#dc2626", padding: "32px 24px", textAlign: "center" }}>
          <div
            style={{
              display: "inline-block",
              backgroundColor: "rgba(255, 255, 255, 0.15)",
              borderRadius: "50%",
              padding: "12px",
              marginBottom: "16px",
            }}
          >
            <span style={{ fontSize: "28px", color: "#ffffff", lineHeight: "1" }}>❌</span>
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
            Import Job Failed
          </h1>
          <p style={{ color: "#fee2e2", margin: "8px 0 0 0", fontSize: "14px" }}>
            An error occurred during the spreadsheet parsing phase.
          </p>
        </div>

        {/* Card Body */}
        <div style={{ padding: "32px 24px" }}>
          <p
            style={{ fontSize: "16px", lineHeight: "1.6", margin: "0 0 20px 0", color: "#374151" }}
          >
            Hi <strong>{props.uploaderName}</strong>,
          </p>
          <p
            style={{ fontSize: "15px", lineHeight: "1.6", margin: "0 0 24px 0", color: "#4b5563" }}
          >
            We encountered a critical failure while trying to import the spreadsheet{" "}
            <code>{props.fileName}</code> for branch <strong>{props.branchCode}</strong>.
          </p>

          {/* Diagnostics Error Alert Block */}
          <div
            style={{
              backgroundColor: "#fef2f2",
              borderLeft: "4px solid #ef4444",
              padding: "20px",
              borderRadius: "12px",
              marginBottom: "32px",
            }}
          >
            <h3
              style={{ margin: "0 0 8px 0", color: "#991b1b", fontSize: "15px", fontWeight: "700" }}
            >
              Diagnostics & Failure Cause:
            </h3>
            <p
              style={{
                margin: 0,
                color: "#b91c1c",
                fontFamily: "Consolas, Monaco, 'Courier New', Courier, monospace",
                fontSize: "13px",
                lineHeight: "1.6",
                wordBreak: "break-word",
                whiteSpace: "pre-wrap",
              }}
            >
              {props.errorMessage}
            </p>
          </div>

          {/* Job Overview Grid */}
          <h4
            style={{
              margin: "0 0 12px 0",
              color: "#374151",
              fontSize: "14px",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Job Information:
          </h4>
          <div
            style={{
              backgroundColor: "#f9fafb",
              borderRadius: "12px",
              border: "1px solid #f3f4f6",
              padding: "16px",
              marginBottom: "32px",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "10px 0", color: "#6b7280", fontSize: "13px" }}>
                    Spreadsheet Name
                  </td>
                  <td
                    style={{
                      padding: "10px 0",
                      textAlign: "right",
                      color: "#111827",
                      fontWeight: "600",
                      fontSize: "13px",
                    }}
                  >
                    {props.fileName}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "10px 0", color: "#6b7280", fontSize: "13px" }}>
                    Branch Code
                  </td>
                  <td
                    style={{
                      padding: "10px 0",
                      textAlign: "right",
                      color: "#111827",
                      fontWeight: "600",
                      fontSize: "13px",
                    }}
                  >
                    <code>{props.branchCode}</code>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "10px 0 0 0", color: "#6b7280", fontSize: "13px" }}>
                    Attempted At
                  </td>
                  <td
                    style={{
                      padding: "10px 0 0 0",
                      textAlign: "right",
                      color: "#111827",
                      fontSize: "13px",
                    }}
                  >
                    {props.completedAt}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Action Button */}
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <a
              href={props.dashboardUrl}
              target="_blank"
              style={{
                display: "inline-block",
                backgroundColor: "#dc2626",
                color: "#ffffff",
                padding: "14px 32px",
                fontSize: "15px",
                fontWeight: "600",
                textDecoration: "none",
                borderRadius: "8px",
                boxShadow: "0 2px 4px rgba(220, 38, 38, 0.2)",
                transition: "all 0.15s ease",
              }}
            >
              Go to Import Manager
            </a>
          </div>

          <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: "24px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af" }}>
              Failure captured at {props.completedAt}
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
