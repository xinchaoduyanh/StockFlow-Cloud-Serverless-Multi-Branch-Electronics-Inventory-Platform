export const UserRole = {
  STORE_MANAGER: "STORE_MANAGER",
  WAREHOUSE: "WAREHOUSE",
  ADMIN: "ADMIN",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ComponentCategory = {
  RAM: "RAM",
  CPU: "CPU",
  SSD: "SSD",
  GPU: "GPU",
  MAINBOARD: "MAINBOARD",
  PSU: "PSU",
  CASE: "CASE",
  COOLER: "COOLER",
} as const;
export type ComponentCategory = (typeof ComponentCategory)[keyof typeof ComponentCategory];

export const ImportStatus = {
  UPLOADED: "UPLOADED",
  PARSING: "PARSING",
  VALIDATING: "VALIDATING",
  PREVIEW_READY: "PREVIEW_READY",
  CONFIRMING: "CONFIRMING",
  COMMITTING: "COMMITTING",
  COMPLETED: "COMPLETED",
  PARTIAL_FAILED: "PARTIAL_FAILED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;
export type ImportStatus = (typeof ImportStatus)[keyof typeof ImportStatus];

export const ImportRowStatus = {
  PENDING: "PENDING",
  VALID: "VALID",
  INVALID: "INVALID",
  COMMITTED: "COMMITTED",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
} as const;
export type ImportRowStatus = (typeof ImportRowStatus)[keyof typeof ImportRowStatus];

export const TransferStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;
export type TransferStatus = (typeof TransferStatus)[keyof typeof TransferStatus];

export const ExportJobStatus = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;
export type ExportJobStatus = (typeof ExportJobStatus)[keyof typeof ExportJobStatus];

export const ReconciliationStatus = {
  OPEN: "OPEN",
  RESOLVED: "RESOLVED",
  IGNORED: "IGNORED",
} as const;
export type ReconciliationStatus = (typeof ReconciliationStatus)[keyof typeof ReconciliationStatus];

export const ReportType = {
  INVENTORY: "inventory",
  LOW_STOCK: "low-stock",
  TRANSFERS: "transfers",
  IMPORT_HISTORY: "import-history",
  STOCK_MOVEMENTS: "stock-movements",
} as const;
export type ReportType = (typeof ReportType)[keyof typeof ReportType];

export const StockMovementReferenceType = {
  TRANSFER: "TRANSFER",
  IMPORT_JOB: "IMPORT_JOB",
  INVENTORY_ADJUSTMENT: "INVENTORY_ADJUSTMENT",
  SYSTEM_SEED: "SYSTEM_SEED",
} as const;
export type StockMovementReferenceType =
  (typeof StockMovementReferenceType)[keyof typeof StockMovementReferenceType];

export const ImportPipelineAction = {
  CONFIRM: "CONFIRM",
  CANCEL: "CANCEL",
} as const;
export type ImportPipelineAction = (typeof ImportPipelineAction)[keyof typeof ImportPipelineAction];

export const DlqReplayResultStatus = {
  REPLAYED: "REPLAYED",
  SKIPPED: "SKIPPED",
  NOT_FOUND: "NOT_FOUND",
  ERROR: "ERROR",
} as const;
export type DlqReplayResultStatus =
  (typeof DlqReplayResultStatus)[keyof typeof DlqReplayResultStatus];

export const COMPONENT_CATEGORIES = [
  "RAM",
  "CPU",
  "SSD",
  "GPU",
  "MAINBOARD",
  "PSU",
  "CASE",
  "COOLER",
] as const;

export const REPORT_TYPES = [
  "inventory",
  "low-stock",
  "transfers",
  "import-history",
  "stock-movements",
] as const;

export const RECONCILIATION_STATUSES = ["OPEN", "RESOLVED", "IGNORED"] as const;

export * from "./reconciliation";
export * from "./inventory";
export * from "./transfers";
export * from "./imports";
export * from "./dlq";
export * from "./reports";
export * from "./auth";
export * from "./notifications";
export * from "./templates";
