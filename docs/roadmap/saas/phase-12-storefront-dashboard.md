# Phase 12: Public Storefront and Dashboard Experience

**Status: Planned**

[Previous: Phase 11](phase-11-plans-billing.md) · [SaaS roadmap](README.md) · [Next: Phase 13](phase-13-receipts-pos.md)

## Objective

Give every branch a focused public booking storefront and give tenant users a
responsive, role-aware workspace with explicit organization and branch context.

## Dependencies

- Phases 8 through 11 provide isolated branch APIs, slugs, membership-aware
  authorization, lifecycle controls, and plan entitlements.

## Deliverables

### Public storefront

- Publish each enabled branch at `/s/:shopSlug` through the scoped public API
  `/api/public/shops/:shopSlug/*`.
- Use a dedicated public layout with no dashboard navigation, login form,
  provider controls, or system diagnostics.
- Add branch fields for unique `slug`, `bookingEnabled`, `publicDescription`,
  `instagramUrl`, and `mapUrl`, with validated formats and safe rendering.
- Present branch name and brand identity, description, address and map action,
  operating hours, phone and WhatsApp actions, Instagram link, service catalog,
  optional barber selection, availability, and booking flow.
- Show a scoped confirmation code after booking and provide an add-to-calendar
  action with correct branch timezone and service details.
- Resolve all catalog, barber, schedule, availability, and booking operations
  from the slug's one shop context; never accept a second unverified shop ID.
- Respect organization suspension, branch publication, booking enablement, plan
  policy, unavailable capacity, and abuse controls with non-sensitive public
  errors.

### Private dashboard

- Build a responsive tenant layout with desktop sidebar, mobile drawer,
  organization and branch switcher, role-aware navigation, account menu, and
  logout.
- Route protected branch pages under `/app/:shopSlug/*` and preserve a verified
  active context across navigation and refresh.
- Show subscription or trial state and relevant actions only to organization
  owners with the required entitlement.
- Filter controls and routes by effective role while retaining server-side
  authorization for every request.
- Keep the provider console in a separate route tree and navigation shell. A
  tenant user never enters it without explicit platform-admin registration.
- Provide clear loading, unavailable-membership, suspended, forbidden,
  not-found, and branch-switch states.

## Acceptance criteria

- Two published slugs display only their own branch identity, services,
  barbers, hours, availability, and confirmation lookup.
- A public booking cannot reference a customer, service, barber, or time slot
  from another shop, including through modified request IDs.
- Disabled booking and suspended organizations reject new public bookings while
  showing a safe branch-appropriate state.
- A multi-branch user can switch explicitly and every dashboard API follows the
  newly authorized branch without another sign-in or stale-data leakage.
- Navigation matches effective organization and shop roles at mobile, tablet,
  and desktop sizes, while direct unauthorized requests still fail server-side.
- Tenant-only identities cannot render or call the provider console.

## Exclusions

- Image uploads, custom domains, white-label storefronts, and a native mobile
  application.
- Secure self-service cancellation and rescheduling links, which are sequenced
  in Phase 15.
- Advanced search-engine marketing or campaign automation.

[Previous: Phase 11](phase-11-plans-billing.md) · [SaaS roadmap](README.md) · [Next: Phase 13](phase-13-receipts-pos.md)
