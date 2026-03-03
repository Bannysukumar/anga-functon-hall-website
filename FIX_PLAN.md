# FIX_PLAN

## Priority Order

1. Security
2. Payment
3. Booking conflicts
4. Admin restrictions
5. Core UI flows
6. Extras

## Executed Fixes

### 1) Security Rules Hardening

- **Files touched**
  - `firestore.rules`
  - `storage.rules`
  - `firebase.json`
- **What changed**
  - Replaced hardcoded admin email checks with role/claim model.
  - Added blocked-user restrictions for booking/coupon/availability writes.
  - Added admin-only `secureSettings` rules.
  - Added storage boundaries for listing images and user-owned uploads.
  - Added safe user cancellation rule path for own bookings.
- **How to test**
  - Non-admin cannot write listings/settings/secureSettings.
  - Blocked user cannot create booking/coupon-based flow.
  - User can cancel only own pending/confirmed bookings.
  - Listing image writes require admin auth.

### 2) Razorpay Verification Security

- **Files touched**
  - `app/api/bookings/create-intent/route.ts`
  - `app/api/bookings/finalize/route.ts`
  - `app/api/payments/verify/route.ts`
  - `app/checkout/page.tsx`
  - `lib/server/firebase-admin.ts`
  - `lib/server/booking-pricing.ts`
  - `package.json` / `package-lock.json` (`razorpay`, `firebase-admin` dependencies)
- **What changed**
  - Added server-authoritative booking-intent endpoint (auth + listing/coupon/pricing validation + order creation).
  - Added server-side HMAC verification bound to intent ID.
  - Added server-side booking finalization transaction that creates booking + payment and updates lock/coupon usage.
  - Checkout now performs intent -> verify -> finalize flow.
- **How to test**
  - Start checkout and verify intent is returned by `/api/bookings/create-intent`.
  - Force invalid signature payload to `/api/payments/verify` and confirm finalize cannot proceed.
  - Confirm valid payment path creates booking and payment record with success navigation.

### 3) Booking Lock Consistency

- **Files touched**
  - `lib/firebase-db.ts`
- **What changed**
  - Fixed `setAvailabilityBlock()` to write lock document using deterministic lock ID (previously random doc IDs were possible).
- **How to test**
  - Block a listing date/slot in admin availability.
  - Attempt booking same slot and verify rejection.

### 4) Settings Persistence Correctness

- **Files touched**
  - `lib/types.ts`
  - `lib/constants.ts`
  - `lib/firebase-db.ts`
  - `app/admin/settings/page.tsx`
- **What changed**
  - Fixed global settings update to stable `settings/global` document.
  - Split sensitive Razorpay secret to `secureSettings`.
  - Added admin settings load/save for secure settings.
- **How to test**
  - Save settings from admin panel.
  - Confirm `settings/global` is updated consistently.
  - Confirm secret writes to `secureSettings/razorpay` and is admin-only.

## Remaining Next Fixes (Not yet implemented)

1. Dedicated `refunds` collection with immutable payout/audit records
2. Ticketing system and review system with policy checks
3. Admin audit log instrumentation across all mutation paths
4. Remove/deprecate legacy `/api/payments/create-order` path
