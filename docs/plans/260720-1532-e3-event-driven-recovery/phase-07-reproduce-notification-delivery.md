# Phase 07: Reproduce Notification Delivery

## Objective

- Manage the notification subscriber with Terraform and make SNS retries secure and idempotent.

## Preconditions

- The production API base URL and TLS endpoint are known.
- The API endpoint is reachable when confirming the subscription.

## Tasks

1. Add `api_base_url` as an explicit Terraform variable instead of deriving it from the frontend URL.
2. Add `aws_sns_topic_subscription` for `${api_base_url}/api/notifications/sns-callback`.
3. Add an SQS delivery DLQ and queue policy allowing only the notification topic/subscription delivery path.
4. Attach the subscription redrive policy and a DLQ depth alarm.
5. Inject the allowed notification topic ARN into the API environment.
6. Add SNS message signature verification in the callback before reading `SubscribeURL` or `Message`.
7. Restrict signing certificate and subscribe URLs to the expected AWS SNS HTTPS hosts and region.
8. Reject unexpected topic ARNs and message types.
9. Remove production direct-JSON fallback; keep local mock input only when explicitly enabled outside production.
10. Use `MessageId` as `Notification.sourceMessageId` and treat duplicate delivery as success.
11. Return a non-2xx response for transient processing failures so SNS retries.
12. Keep writer/fail-handler notification publication outside inventory commit failure semantics.
13. Add fixture tests for valid notification, duplicate message, invalid signature, malicious SubscribeURL, wrong topic, confirmation, and transient handler failure.
14. Add a runbook check that the Terraform subscription ARN is confirmed rather than `PendingConfirmation`.

## Verification

- Commands:
  - `npm test -- --runInBand`
  - `npm run lint`
  - `npm run build`
  - `terraform fmt -check -recursive`
  - `terraform validate`
- Expected results:
  - The subscription is fully represented in Terraform.
  - Spoofed or wrong-topic requests cannot create notifications or trigger arbitrary fetches.
  - Duplicate SNS delivery creates one notification.
  - Notification delivery failure cannot roll back committed inventory.

## Exit Criteria

- [ ] E3-09 is implemented and tested.
- [ ] SNS delivery retry and DLQ behavior are documented.
- [ ] No manual subscription step remains undocumented.
