# DATA_AUDIT

## Firestore Collection Coverage vs Spec

- ✅ Present: `users`, `branches`, `listings`, `availabilityLocks`, `bookings`, `coupons`, `settings`, `payments`, `bookingIntents`
- ✅ Added (security split): `secureSettings`
- ❌ Missing as first-class collections:
  - `admins` (admin handled via user role/claim, no separate collection)
  - `addons` (embedded in listing documents)
  - `slotTemplates` (not implemented)
  - `inventory` (inventory modeled inside listing + availabilityLocks)
  - `refunds` (refund fields embedded in booking)
  - `tours` (tour is a listing type, not separate collection)
  - `reviews`
  - `tickets`
  - `cmsPages`
  - `auditLogs`

## Query + Index Audit

- Current code intentionally keeps some queries simple (client-side filtering) to avoid composite index requirements.
- No `firestore.indexes.json` file exists in repo.
- High-volume scaling risk:
  - Admin pages load broad datasets then filter on client.
  - Add explicit indexes if data volume grows and move filtering server-side.

## Timestamp Consistency

- ✅ `serverTimestamp()` used for major create/update paths:
  - branches
  - listings
  - bookings
  - availability locks
  - settings

## ID/Reference Consistency

- ✅ Core refs consistent: booking references `listingId`, `branchId`, Razorpay IDs.
- ✅ Availability lock ID normalization now consistent (`listingId_date_slotId`) after fix.
- ✅ Payment records now exist in `payments` with `bookingId` references.
