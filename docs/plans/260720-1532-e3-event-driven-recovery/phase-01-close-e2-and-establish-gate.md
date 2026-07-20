# Phase 01: Close E2 and Establish the Gate

## Objective

- Fix the verified E2 security gap and make lint/test/build/CI a real prerequisite for E3.

## Preconditions

- Work starts from commit `343c514` or a descendant that preserves its authorization changes.
- No E3 production resources are applied during this phase.

## Tasks

1. Re-run and record `git status --short --branch`, tests, builds, and source-only lint counts.
2. Add `**/.aws-sam/**` to `eslint.config.mjs` ignores so generated SAM artifacts are never lint inputs.
3. Add a CommonJS/Node override for `esbuild.config.js` and `apps/lambdas/generate-sample-sheet.js`.
4. Resolve the remaining source lint errors and warnings until `npm run lint` passes with `--max-warnings=0`.
5. Split report authorization into a create policy and a read policy in `apps/api/src/auth/authorization-policy.service.ts`.
6. In the create policy, validate requested branch scope before considering resource ownership.
7. Update `apps/api/src/reports/reports.service.ts` so non-admin report filters are always forced to `actor.branchId`.
8. Remove optional `AuthorizationPolicyService` injection and optional chaining from route-facing inventory, import, report, transfer, DLQ, and reconciliation services.
9. Update unit test constructors to inject a real policy service or an explicit strict mock.
10. Add report cross-branch create/get/download denial tests.
11. Add role-by-action-by-branch API tests for inventory, imports, reports, transfers, DLQ, and reconciliation.
12. Add inactive-user and IDOR cases to the API authorization suite.
13. Decide and encode whether a branch user may create a transfer only from their branch or from either related branch; document the chosen rule in the matrix.
14. Add `.github/workflows/quality.yml` for lockfile install, Prisma generate, lint, tests, builds, Lambda build, Terraform format/validate, and dependency audit.
15. Ensure CI excludes secrets, state, generated SAM output, and Terraform build archives from artifacts/caches.
16. Update `plans/feature-rebuild/phase-2-authorization-and-quality.md` and `BACKLOG.md` only after every corresponding check has evidence.

## Verification

- Commands:
  - `npm run lint`
  - `npm test -- --runInBand`
  - `npm --workspace apps/api run test:postgres`
  - `npm run build`
  - `npm run build:lambdas`
  - `git diff --check`
- Expected results:
  - A branch user cannot create a report for another branch.
  - Missing policy wiring fails module construction instead of silently bypassing authorization.
  - Authorization matrix tests cover controller guards and service ownership checks.
  - Lint has zero errors and zero warnings.
  - CI contains all E2 quality gates and no deploy job.

## Exit Criteria

- [ ] E2 authorization acceptance criteria are covered by automated tests.
- [ ] E2 lint and CI items are complete.
- [ ] All local quality commands pass.
- [ ] E3 work does not inherit a known authorization bypass.
