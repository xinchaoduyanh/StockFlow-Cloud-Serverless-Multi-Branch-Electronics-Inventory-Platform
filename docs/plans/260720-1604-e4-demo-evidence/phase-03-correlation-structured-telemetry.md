# Phase 03: Add Correlation-Aware Structured Telemetry

## Objective

- Make one demo action traceable across HTTP, API services, queue messages, Step Functions, Lambda workers, and recovery records without logging sensitive payloads.

## Preconditions

- Final E3 message schemas and resource IDs are stable.
- CloudWatch log groups and IAM paths are owned by Terraform.

## Tasks

1. Add a request-context utility that validates an incoming `x-correlation-id` or creates a UUID, caps length, and returns the ID in the response header.
2. Replace the plain HTTP log line with structured JSON fields: timestamp, level, service, correlationId, method, route, status, durationMs, userId, role, branchId, errorCode, and safe resource IDs.
3. Add actor context after authentication so logs include user/role/branch without serializing tokens or full request bodies.
4. Define shared correlation metadata for report messages, import execution input, recovery events, and benchmark requests; propagate only identifiers and versioned metadata.
5. Update API, report, import, recovery, and reconciliation logs to use stable event names and error codes.
6. Update Lambda handlers to emit structured start/success/failure records with AWS request ID, correlation ID, job ID, and duration; redact task tokens, receipt handles, secrets, and raw Excel rows.
7. Preserve OpenTelemetry traces and document the relationship between trace ID and application correlation ID; add a fallback when the collector is absent.
8. Add unit tests for generated/accepted IDs, invalid IDs, response header, actor fields, redaction, and propagation through a queue/SFN message fixture.

## Verification

- Commands:
  - `npm test -- --runInBand`
  - `npm run build`
  - `npm run build:lambdas`
  - `npm run lint`
- Manual checks:
  - Run one report, one import, and one recovery action with a known correlation ID.
  - Search API/Lambda/Step Functions logs for the ID and compare event sequence/timings.
  - Confirm tokens, authorization headers, queue bodies, and raw workbook values do not appear.

## Exit Criteria

- [ ] Correlation ID is present and stable across the full async path.
- [ ] Logs are valid structured JSON and contain the agreed safe fields.
- [ ] Redaction and propagation tests pass.
- [ ] Telemetry documentation is synchronized with the deployed topology.
