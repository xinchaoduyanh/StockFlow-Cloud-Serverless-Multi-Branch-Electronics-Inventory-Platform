# Phase 05: Add Report Recovery Operations

## Objective

- Provide safe, bounded, audited recovery for failed report work without exposing queue payloads.

## Preconditions

- The report queue/DLQ and persistence changes from Phases 3-4 exist.
- E2 admin authorization is fail closed.

## Tasks

1. Create `apps/api/src/recovery/` with an ADMIN-only controller, service, DTOs, and module.
2. Add a failed/discarded report list backed by `ExportJob`, scoped to safe metadata.
3. Add queue metrics backed by `GetQueueAttributes`; expose counts/age only, never message bodies.
4. Add a single-job replay endpoint that requires a reason and checks status/attempt bounds.
5. Claim the replay attempt transactionally, reset the report to `PENDING`, append `AuditLog`, and send a fresh versioned queue message.
6. On SQS dispatch failure, restore a recoverable state and append a failed-dispatch audit event.
7. Add report discard with required reason, terminal `DISCARDED` state, and audit summary.
8. Ensure redriven messages for discarded/completed jobs are acknowledged as idempotent no-ops.
9. Add an ADMIN-only bulk DLQ redrive endpoint using `StartMessageMoveTask`.
10. Bound redrive velocity and prevent a second active move task.
11. Audit redrive start/result metadata without storing message bodies.
12. Add alarms and runbook links to the queue metrics response.
13. Add controller/service tests for non-admin denial, missing reason, replay limit, duplicate action, discard, and redrive conflict.
14. Keep legacy `/admin/dlq/*` aliases only if compatibility is confirmed; mark them deprecated and route through the new audited service.

## Verification

- Commands:
  - `npm test -- --runInBand`
  - `npm --workspace apps/api run test:postgres`
  - `npm run lint`
  - `npm run build`
- Expected results:
  - Recovery endpoints require ADMIN at guard and service layers.
  - Every replay/discard/redrive action has actor, reason, resource, and timestamp.
  - No endpoint returns raw SQS bodies or receipt handles.
  - Replaying a completed/discarded job cannot duplicate output.

## Exit Criteria

- [ ] E3-05 report recovery actions and alarms are implemented.
- [ ] Audit requirements are enforced in database tests.
- [ ] Legacy endpoint compatibility is resolved.
