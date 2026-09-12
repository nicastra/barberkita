# Phase 13: Printable Receipts and POS Improvements

**Status: Planned**

[Previous: Phase 12](phase-12-storefront-dashboard.md) · [SaaS roadmap](README.md) · [Next: Phase 14](phase-14-barber-performance.md)

## Objective

Provide stable, tenant-scoped receipt history and practical browser printing for
common paper sizes without binding the pilot to printer-specific protocols.

## Dependencies

- Phase 12 provides the branch-scoped dashboard route and role-aware tenant
  layout.
- Existing checkout and correction history provides the financial source of
  truth, strengthened by Phase 8 tenant constraints.

## Deliverables

- Add `/app/:shopSlug/checkout/:checkoutId/receipt` and authorize the checkout
  against both the active shop context and effective role.
- Support browser-print layouts for 58 mm, 80 mm, and A4 with readable screen
  previews and print-specific styles.
- Display branch identity, tenant-scoped receipt number, timestamp in the shop
  timezone, customer, barber, line items, discounts, payments, refunds, total,
  and remaining balance.
- Label unpaid, partially paid, paid, and refunded states unambiguously and
  represent corrections without rewriting history.
- Persist checkout-time snapshots of shop display identity, customer display
  value, barber, item descriptions, quantities, prices, discounts, taxes if
  later applicable, and relevant totals so catalog or profile changes do not
  alter historical receipts.
- Scope receipt lookup and numbering to the shop, use collision-safe creation,
  and reject cross-shop checkout IDs even when a receipt number looks valid.
- Support Print and browser Save as PDF from supported phones, tablets, and
  desktops, with an accessible non-print representation.

## Acceptance criteria

- An authorized role can open and print the same checkout in each supported
  format with totals that reconcile to append-only payment and refund history.
- Catalog, service, barber, customer, or shop-profile edits after checkout do
  not change the receipt's historical snapshot.
- Unpaid, partial, paid, and refunded examples have correct labels, totals, paid
  amounts, refund amounts, and remaining balances.
- Changing the shop slug, checkout ID, or receipt number cannot retrieve a
  receipt belonging to another branch.
- Print output is usable at 58 mm, 80 mm, and A4 and can be saved as PDF on the
  supported browser matrix.

## Exclusions

- Direct Bluetooth, USB, network-printer discovery, raw ESC/POS output, cash
  drawer control, and printer-driver support.
- Automated tax invoicing or fiscal-device certification.
- Product inventory and retail-stock management.

[Previous: Phase 12](phase-12-storefront-dashboard.md) · [SaaS roadmap](README.md) · [Next: Phase 14](phase-14-barber-performance.md)
