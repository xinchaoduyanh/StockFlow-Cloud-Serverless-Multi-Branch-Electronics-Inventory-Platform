type BadgeTone = "neutral" | "accent" | "ok" | "warn" | "danger";

type StatusStyle = { label: string; tone: BadgeTone };

const STATUS_STYLES: Record<string, StatusStyle> = {
  VALID: { label: "Hợp lệ", tone: "ok" },
  INVALID: { label: "Lỗi dòng", tone: "danger" },
  PENDING: { label: "Chờ duyệt", tone: "warn" },
  APPROVED: { label: "Đã duyệt", tone: "ok" },
  REJECTED: { label: "Từ chối", tone: "danger" },
  COMPLETED: { label: "Hoàn thành", tone: "ok" },
  FAILED: { label: "Thất bại", tone: "danger" },
  CANCELLED: { label: "Đã hủy", tone: "neutral" },
  PROCESSING: { label: "Đang xử lý", tone: "warn" },
  DISCARDED: { label: "Đã bỏ", tone: "neutral" },
  UPLOADED: { label: "Đã tải lên", tone: "neutral" },
  PARSING: { label: "Đang đọc tệp", tone: "warn" },
  VALIDATING: { label: "Đang phân tích", tone: "warn" },
  PREVIEW_READY: { label: "Chờ xác nhận", tone: "accent" },
  CONFIRMING: { label: "Đang xác nhận", tone: "warn" },
  COMMITTING: { label: "Đang lưu kho", tone: "warn" },
  PARTIAL_FAILED: { label: "Lỗi một phần", tone: "warn" },
  OPEN: { label: "Chưa đối soát", tone: "danger" },
  RESOLVED: { label: "Đã đối soát", tone: "ok" },
  IGNORED: { label: "Bỏ qua", tone: "neutral" },
  ACTIVE: { label: "Đang hoạt động", tone: "ok" },
  INACTIVE: { label: "Ngừng hoạt động", tone: "neutral" },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? { label: status, tone: "neutral" };

  return <span className={`badge badge-${style.tone} whitespace-nowrap`}>{style.label}</span>;
}
