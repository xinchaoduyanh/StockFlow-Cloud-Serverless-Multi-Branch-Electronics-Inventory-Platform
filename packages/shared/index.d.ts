export declare const UserRole: {
  readonly STORE_MANAGER: "STORE_MANAGER";
  readonly WAREHOUSE: "WAREHOUSE";
  readonly ADMIN: "ADMIN";
};
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export declare const ComponentCategory: {
  readonly RAM: "RAM";
  readonly CPU: "CPU";
  readonly SSD: "SSD";
  readonly GPU: "GPU";
  readonly MAINBOARD: "MAINBOARD";
  readonly PSU: "PSU";
  readonly CASE: "CASE";
  readonly COOLER: "COOLER";
};
export type ComponentCategory = (typeof ComponentCategory)[keyof typeof ComponentCategory];

export declare const ImportStatus: {
  readonly UPLOADED: "UPLOADED";
  readonly PARSING: "PARSING";
  readonly VALIDATING: "VALIDATING";
  readonly PREVIEW_READY: "PREVIEW_READY";
  readonly CONFIRMING: "CONFIRMING";
  readonly COMMITTING: "COMMITTING";
  readonly COMPLETED: "COMPLETED";
  readonly PARTIAL_FAILED: "PARTIAL_FAILED";
  readonly FAILED: "FAILED";
  readonly CANCELLED: "CANCELLED";
};
export type ImportStatus = (typeof ImportStatus)[keyof typeof ImportStatus];

export declare const ImportRowStatus: {
  readonly PENDING: "PENDING";
  readonly VALID: "VALID";
  readonly INVALID: "INVALID";
  readonly COMMITTED: "COMMITTED";
  readonly FAILED: "FAILED";
  readonly SKIPPED: "SKIPPED";
};
export type ImportRowStatus = (typeof ImportRowStatus)[keyof typeof ImportRowStatus];

export declare const TransferStatus: {
  readonly PENDING: "PENDING";
  readonly APPROVED: "APPROVED";
  readonly REJECTED: "REJECTED";
  readonly COMPLETED: "COMPLETED";
  readonly FAILED: "FAILED";
  readonly CANCELLED: "CANCELLED";
};
export type TransferStatus = (typeof TransferStatus)[keyof typeof TransferStatus];

export declare const ExportJobStatus: {
  readonly PENDING: "PENDING";
  readonly PROCESSING: "PROCESSING";
  readonly COMPLETED: "COMPLETED";
  readonly FAILED: "FAILED";
};
export type ExportJobStatus = (typeof ExportJobStatus)[keyof typeof ExportJobStatus];

export declare const ReconciliationStatus: {
  readonly OPEN: "OPEN";
  readonly RESOLVED: "RESOLVED";
  readonly IGNORED: "IGNORED";
};
export type ReconciliationStatus = (typeof ReconciliationStatus)[keyof typeof ReconciliationStatus];

export declare const ReportType: {
  readonly INVENTORY: "inventory";
  readonly LOW_STOCK: "low-stock";
  readonly TRANSFERS: "transfers";
  readonly IMPORT_HISTORY: "import-history";
  readonly STOCK_MOVEMENTS: "stock-movements";
};
export type ReportType = (typeof ReportType)[keyof typeof ReportType];

export declare const StockMovementReferenceType: {
  readonly TRANSFER: "TRANSFER";
  readonly IMPORT_JOB: "IMPORT_JOB";
  readonly INVENTORY_ADJUSTMENT: "INVENTORY_ADJUSTMENT";
  readonly SYSTEM_SEED: "SYSTEM_SEED";
};
export type StockMovementReferenceType =
  (typeof StockMovementReferenceType)[keyof typeof StockMovementReferenceType];

export declare const ImportPipelineAction: {
  readonly CONFIRM: "CONFIRM";
  readonly CANCEL: "CANCEL";
};
export type ImportPipelineAction = (typeof ImportPipelineAction)[keyof typeof ImportPipelineAction];

export declare const DlqReplayResultStatus: {
  readonly REPLAYED: "REPLAYED";
  readonly SKIPPED: "SKIPPED";
  readonly NOT_FOUND: "NOT_FOUND";
  readonly ERROR: "ERROR";
};
export type DlqReplayResultStatus =
  (typeof DlqReplayResultStatus)[keyof typeof DlqReplayResultStatus];

export declare const COMPONENT_CATEGORIES: readonly [
  "RAM",
  "CPU",
  "SSD",
  "GPU",
  "MAINBOARD",
  "PSU",
  "CASE",
  "COOLER",
];

export declare const REPORT_TYPES: readonly [
  "inventory",
  "low-stock",
  "transfers",
  "import-history",
  "stock-movements",
];

export declare const RECONCILIATION_STATUSES: readonly ["OPEN", "RESOLVED", "IGNORED"];
