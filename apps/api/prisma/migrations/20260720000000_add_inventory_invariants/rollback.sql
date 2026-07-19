ALTER TABLE "inventory"
  DROP CONSTRAINT IF EXISTS "inventory_quantity_non_negative",
  DROP CONSTRAINT IF EXISTS "inventory_reserved_quantity_non_negative",
  DROP CONSTRAINT IF EXISTS "inventory_reserved_quantity_not_above_quantity",
  DROP CONSTRAINT IF EXISTS "inventory_min_stock_threshold_non_negative";

DROP INDEX IF EXISTS "import_job_rows_import_job_id_row_number_key";
