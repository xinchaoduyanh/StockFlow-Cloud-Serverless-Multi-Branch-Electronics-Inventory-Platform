-- Enforce inventory invariants at the database boundary as well as in the service layer.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "inventory" WHERE "quantity" < 0) THEN
    RAISE EXCEPTION 'inventory preflight failed: quantity contains negative values';
  END IF;
  IF EXISTS (SELECT 1 FROM "inventory" WHERE "reserved_quantity" < 0) THEN
    RAISE EXCEPTION 'inventory preflight failed: reserved_quantity contains negative values';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM "inventory"
    WHERE "reserved_quantity" > "quantity"
  ) THEN
    RAISE EXCEPTION 'inventory preflight failed: reserved_quantity exceeds quantity';
  END IF;
  IF EXISTS (SELECT 1 FROM "inventory" WHERE "min_stock_threshold" < 0) THEN
    RAISE EXCEPTION 'inventory preflight failed: min_stock_threshold contains negative values';
  END IF;
END $$;

ALTER TABLE "inventory"
  ADD CONSTRAINT "inventory_quantity_non_negative"
  CHECK ("quantity" >= 0),
  ADD CONSTRAINT "inventory_reserved_quantity_non_negative"
  CHECK ("reserved_quantity" >= 0),
  ADD CONSTRAINT "inventory_reserved_quantity_not_above_quantity"
  CHECK ("reserved_quantity" <= "quantity"),
  ADD CONSTRAINT "inventory_min_stock_threshold_non_negative"
  CHECK ("min_stock_threshold" >= 0);

CREATE UNIQUE INDEX "import_job_rows_import_job_id_row_number_key"
  ON "import_job_rows"("import_job_id", "row_number");
