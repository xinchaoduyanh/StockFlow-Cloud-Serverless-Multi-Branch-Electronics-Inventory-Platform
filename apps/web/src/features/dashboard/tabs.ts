import type { IconName } from "@/components/Icon";

type TabGroup = "operations" | "admin";

type DashboardTab = {
  id: string;
  label: string;
  description: string;
  icon: IconName;
  group: TabGroup;
};

export const DASHBOARD_TABS = [
  {
    id: "inventory",
    label: "Tồn kho",
    description: "Số lượng theo chi nhánh và danh mục",
    icon: "package",
    group: "operations",
  },
  {
    id: "transfers",
    label: "Chuyển kho",
    description: "Tạo và duyệt yêu cầu chuyển hàng giữa chi nhánh",
    icon: "transfer",
    group: "operations",
  },
  {
    id: "imports",
    label: "Nhập kho",
    description: "Nhập hàng hàng loạt từ file Excel",
    icon: "upload",
    group: "operations",
  },
  {
    id: "low-stock",
    label: "Cảnh báo tồn thấp",
    description: "Mặt hàng đã chạm mức tối thiểu",
    icon: "alert",
    group: "operations",
  },
  {
    id: "reports",
    label: "Báo cáo và thống kê",
    description: "Xuất báo cáo ra file để lưu hoặc gửi",
    icon: "chart",
    group: "operations",
  },
  {
    id: "dlq",
    label: "Khôi phục sự cố",
    description: "Xử lý lại các tác vụ nền bị lỗi",
    icon: "lifebuoy",
    group: "admin",
  },
  {
    id: "reconciliation",
    label: "Đối soát tồn kho",
    description: "So sánh số liệu sổ sách với số thực tế",
    icon: "reconcile",
    group: "admin",
  },
  {
    id: "users",
    label: "Quản lý nhân viên",
    description: "Tài khoản, vai trò và chi nhánh phụ trách",
    icon: "users",
    group: "admin",
  },
  {
    id: "branches",
    label: "Quản lý chi nhánh",
    description: "Danh sách chi nhánh đang hoạt động",
    icon: "store",
    group: "admin",
  },
] as const satisfies readonly DashboardTab[];

export type TabId = (typeof DASHBOARD_TABS)[number]["id"];

export const TAB_GROUP_LABELS: Record<TabGroup, string> = {
  operations: "Vận hành",
  admin: "Quản trị",
};
