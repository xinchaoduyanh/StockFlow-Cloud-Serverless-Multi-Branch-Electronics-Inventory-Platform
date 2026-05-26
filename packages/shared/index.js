/* global module */
"use strict";

const UserRole = {
  STORE_MANAGER: "STORE_MANAGER",
  WAREHOUSE: "WAREHOUSE",
  ADMIN: "ADMIN",
};

const ComponentCategory = {
  RAM: "RAM",
  CPU: "CPU",
  SSD: "SSD",
  GPU: "GPU",
  MAINBOARD: "MAINBOARD",
  PSU: "PSU",
  CASE: "CASE",
  COOLER: "COOLER",
};

const ImportStatus = {
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
};

const ImportRowStatus = {
  PENDING: "PENDING",
  VALID: "VALID",
  INVALID: "INVALID",
  COMMITTED: "COMMITTED",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
};

const TransferStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
};

const ExportJobStatus = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
};

const ReconciliationStatus = {
  OPEN: "OPEN",
  RESOLVED: "RESOLVED",
  IGNORED: "IGNORED",
};

const ReportType = {
  INVENTORY: "inventory",
  LOW_STOCK: "low-stock",
  TRANSFERS: "transfers",
  IMPORT_HISTORY: "import-history",
  STOCK_MOVEMENTS: "stock-movements",
};

const StockMovementReferenceType = {
  TRANSFER: "TRANSFER",
  IMPORT_JOB: "IMPORT_JOB",
  INVENTORY_ADJUSTMENT: "INVENTORY_ADJUSTMENT",
  SYSTEM_SEED: "SYSTEM_SEED",
};

const ImportPipelineAction = {
  CONFIRM: "CONFIRM",
  CANCEL: "CANCEL",
};

const DlqReplayResultStatus = {
  REPLAYED: "REPLAYED",
  SKIPPED: "SKIPPED",
  NOT_FOUND: "NOT_FOUND",
  ERROR: "ERROR",
};

const COMPONENT_CATEGORIES = Object.values(ComponentCategory);
const REPORT_TYPES = Object.values(ReportType);
const RECONCILIATION_STATUSES = Object.values(ReconciliationStatus);

module.exports = {
  UserRole,
  ComponentCategory,
  ImportStatus,
  ImportRowStatus,
  TransferStatus,
  ExportJobStatus,
  ReconciliationStatus,
  ReportType,
  StockMovementReferenceType,
  ImportPipelineAction,
  DlqReplayResultStatus,
  COMPONENT_CATEGORIES,
  REPORT_TYPES,
  RECONCILIATION_STATUSES,
};
