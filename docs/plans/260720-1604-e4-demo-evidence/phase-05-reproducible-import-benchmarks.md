# Phase 05: Run Reproducible 10k/50k Import Benchmarks

## Objective

- Measure the deployed ingestion path on deterministic workloads and publish enough context for another engineer to reproduce the result.

## Preconditions

- Demo environment, E3 retries/recovery, correlation telemetry, and dashboards pass.
- A benchmark window and database/resource configuration are approved.

## Tasks

1. Add a deterministic workbook generator under `scripts/benchmark/` for 10,000 and 50,000 rows, including valid, invalid, duplicate, and retry-safe cases with a fixed seed.
2. Keep generated workbooks, logs, raw exports, and cloud state outside Git; write only sanitized metadata/results to `docs/evidence/benchmarks/`.
3. Add a runner that uploads through the real S3/EventBridge/Step Functions path, waits for terminal state, and records correlation ID, execution ARN, checksum, file size, configuration, phase timestamps, status, row counts, error rate, and recovery outcome.
4. Measure at least cold-start and warm runs, with enough repetitions to report median and range; separate parser, validation, approval/writer, and total duration where the orchestration exposes them.
5. Record Lambda memory/timeout, Aurora capacity/configuration, queue batch/visibility settings, region, Node/runtime versions, and whether the database was warm.
6. Add duplicate/retry benchmark cases and verify no duplicate inventory movement, import commit, report artifact, or recovery item.
7. Estimate per-run cost only from documented AWS pricing/billing data and label assumptions; do not infer monthly cost from one short run without caveats.
8. Produce a Markdown benchmark report with commands, dataset checksums, tables, limitations, and a clear distinction between measured values and targets.

## Verification

- Commands:
  - `node scripts/benchmark/generate-import-workbook.mjs --rows 10000 --seed ...`
  - `node scripts/benchmark/generate-import-workbook.mjs --rows 50000 --seed ...`
  - `node scripts/benchmark/run-import.mjs --file ... --environment demo`
  - `npm test -- --runInBand`
- Expected results:
  - Both datasets complete or fail with a documented, observable terminal status.
  - Results include exact input checksum and no raw credential/payload data.
  - Re-running the same duplicate/retry case leaves inventory and ledger counts consistent.

## Exit Criteria

- [ ] 10k and 50k benchmark runs are reproducible.
- [ ] Warm/cold and failure/retry behavior is reported.
- [ ] Throughput, duration, error rate, and cost assumptions are documented.
- [ ] No CV/README claim exceeds the measured evidence.

