# SECURITY_AUDIT

## A) Firebase Security Rules

- ✅ Users cannot read other users' bookings (`bookings` read restricted by `resource.data.userId == request.auth.uid`).
- ✅ Admin can access full data (admin role/custom-claim checks).
- ✅ Blocked users cannot create bookings/orders at Firestore layer (booking create denied when blocked).
- ✅ Storage rules added and deployed:
  - listing images: admin write only
  - user uploads: owner-only path writes
- ✅ No `allow read, write: if true` catch-all patterns found in active rules.
- ⚠️ `settings` remains publicly readable for non-sensitive config by design; secrets moved to `secureSettings`.

## B) Razorpay Security

- ✅ Razorpay secret is not used in frontend code.
- ✅ Signature verification moved to server endpoint (`/api/payments/verify`).
- ✅ Booking confirmation occurs only after verify endpoint returns `verified=true`.
- ✅ Direct client-side confirmation without verification removed from checkout flow.
- ⚠️ Verification is implemented in Next.js server routes, not Firebase Cloud Functions.

## C) Data Validation

- ✅ Amount validation moved to server-authoritative intent pricing path.
- ✅ Booking conflict checks are server-enforced at Firestore transaction/rules level for lock+inventory.
- ❌ Coupon misuse prevention is partial:
  - expiry and active status validated
  - usage count incremented at finalize transaction
  - missing per-user usage controls

## Security Fixes Applied

1. `firestore.rules`
   - Replaced hardcoded admin-email-only pattern with role/claim based checks.
   - Added blocked-user restrictions for bookings/coupon/locks.
   - Added `secureSettings` admin-only access.
   - Added controlled user cancellation updates for own bookings.

2. `storage.rules` + `firebase.json`
   - Introduced explicit storage rule boundaries.
   - Deployed storage rules to project.

3. `app/api/payments/*`
   - Added server-side order creation and signature verification.

4. New server-authoritative booking pipeline
   - `app/api/bookings/create-intent/route.ts`: validates user/listing/coupon and computes trusted pricing.
   - `app/api/bookings/finalize/route.ts`: creates booking + payment in transaction after verified payment.
