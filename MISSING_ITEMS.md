# MISSING_ITEMS

## Missing or Incomplete Items Discovered

| File Path | What is missing | Severity | Recommended fix |
|---|---|---|---|
| `lib/firebase-db.ts` | No dedicated `refunds` engine (only status flags on booking) | Medium | Add `refunds` collection with request/approval/payout timeline |
| `app/dashboard/bookings/[id]/page.tsx` + `app/admin/bookings/page.tsx` | Refund workflow has no payout proof/reference tracking | Medium | Add refund transaction ID, processor status, and audit trail |
| `app/` (no ticket routes/components) | Support ticket module missing | Medium | Add user ticket create/list page and admin response console |
| `app/` (no review routes/components) | Reviews module missing and post-completion gating absent | Medium | Add review create endpoint and enforce booking completed check |
| `app/` (no cms pages editor) | CMS editable pages missing | Medium | Add `cmsPages` collection + admin editor + public page renderer |
| `app/` + `lib/` | Admin audit logs not implemented | High | Add centralized `logAdminAction()` helper and write on booking/listing/settings mutations |
| `firestore.indexes.json` | Index definition file missing | Low | Add index file and define composite indexes used by admin/booking queries |
| `lib/firebase-auth.ts` | Admin model is mixed (email list + role + claim); no single source policy doc | Low | Consolidate admin authorization policy and document precedence |
| `app/api/payments/create-order/route.ts` | Legacy route remains but checkout now uses booking-intent route | Low | Remove/deprecate legacy endpoint after migration validation |

## TODO/FIXME/Placeholder Scan

- No explicit `TODO`/`FIXME` markers found in primary TypeScript app code.
- No hardcoded "coming soon" placeholders found in core route pages.
