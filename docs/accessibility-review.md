# Accessibility and Responsive Review

Phase 7 uses a pragmatic WCAG 2.2 AA baseline for the single-shop MVP. Recheck
this document when shared navigation, forms, status handling, or theme colors
change.

## Reviewed baseline

- Every route has a visible heading and the application provides a keyboard
  skip link to the focusable main region. Internal navigation uses links and
  route protection preserves the requested URL.
- Forms use programmatic labels, native input types, required states, and
  keyboard-operable controls. Buttons have visible names, selected appointment
  slots expose `aria-pressed`, and focus indicators are explicit for form
  controls and shared buttons.
- Loading and success updates use polite live regions; request and permission
  failures use alerts. Empty results are distinct from loading and failure.
- Semantic headings, lists, description lists, and tables are retained. Report
  tables have captions and horizontal overflow rather than clipping.
- The theme uses dark foreground text on light surfaces and does not rely on
  color alone for status. Reduced-motion preferences suppress nonessential
  animation and transitions.
- Layouts stack at the 320 px minimum, use multi-column tablet layouts when
  space permits, and constrain desktop content. Navigation wraps instead of
  overflowing; dashboard tables remain scrollable.

## Manual release pass

At 320–480 px mobile, 768–1024 px tablet, and 1280 px or wider desktop:

1. Navigate sign-in, public booking, appointments, checkout, dashboard, and
   owner scheduling using keyboard only.
2. Confirm focus order, focus visibility, skip-link behavior, labels, selected
   slot announcement, live status updates, and error recovery.
3. Zoom browser content to 200% and confirm no action or information is lost.
4. Check text and UI-component contrast with an automated contrast tool.
5. Repeat the public booking and protected critical journey with a current
   screen reader and record any release-blocking issue in the release system.

Automated component and HTTP tests prevent contract regressions, but they do not
replace the manual assistive-technology pass in the release checklist.
