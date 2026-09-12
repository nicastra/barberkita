# Phase 11: Plans, Limits, and Manual Billing

**Status: Planned**

[Previous: Phase 10](phase-10-provider-onboarding.md) · [SaaS roadmap](README.md) · [Next: Phase 12](phase-12-storefront-dashboard.md)

## Objective

Represent commercial plans and subscriptions, enforce tenant entitlements
reliably, and support manual pilot billing before integrating a payment gateway.

## Dependencies

- Phase 10 provides provider-approved organizations, lifecycle states, trial
  initialization, provider administration, and audited state changes.

## Deliverables

- Add `plans`, `plan_features`, `organization_subscriptions`, and append-only
  `subscription_events` with effective dates and audited changes.
- Represent trial start and end, plan, renewal date, manual payment record,
  suspension, cancellation, and subscription status without storing payment
  credentials.
- Define initial limits for maximum branches, active users, active barbers,
  reporting availability, data-retention policy, and advanced support features.
- Centralize entitlement and usage checks in server services and invoke them in
  the same transaction as writes that consume a limited resource.
- Return stable machine-readable errors containing the exhausted entitlement
  and current limit, without exposing sensitive provider configuration.
- Make deactivation and reactivation behavior explicit so archived users or
  barbers do not consume active limits unless the plan says otherwise.
- Show organization owners current plan, trial or renewal state, relevant usage,
  and actions that require provider coordination.
- Let provider administrators record manual payments and authorized plan or
  lifecycle changes with an audit trail and idempotency protection.
- Define retention enforcement separately from immediate destructive deletion;
  no tenant data is silently removed when a plan changes.

## Acceptance criteria

- The same effective entitlement decision is used by APIs, onboarding, and the
  frontend; hiding a client control is never the only enforcement.
- Branch, active-user, and active-barber limits remain correct when concurrent
  requests attempt to consume the final available slot.
- Stable limit errors allow the client to explain which capability is blocked
  and organization owners can see current usage.
- Trial expiry, manual renewal, suspension, cancellation, and reactivation
  produce an ordered subscription history and corresponding tenant behavior.
- Provider retries cannot create duplicate manual payment or subscription
  events.
- Reporting and support features are rejected server-side when the current plan
  does not grant them.

## Exclusions

- Recurring gateway charges, stored payment methods, webhook processing,
  retries, dunning, automated invoices, and tax calculation.
- Usage-based metering and overage billing.
- Irreversible automated deletion triggered solely by subscription state.

[Previous: Phase 10](phase-10-provider-onboarding.md) · [SaaS roadmap](README.md) · [Next: Phase 12](phase-12-storefront-dashboard.md)
