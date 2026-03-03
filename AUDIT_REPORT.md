# AUDIT_REPORT

## A) Feature Coverage

- ✅ Auth: signup/login/forgot
- ✅ Admin access restriction (role-based admin + admin email/custom claim checks)
- ✅ Listings CRUD for service types (Function Hall, Rooms, Dormitory, Dining Hall, Open Hall, Tours)
- ❌ Slots system templates + per-listing enable/disable (only per-listing slots exist; no reusable template module)
- ✅ Availability calendar + admin blocking
- ✅ Booking flow end-to-end
- ✅ Prevent double booking (transaction-based lock)
- ✅ Room inventory / dorm inventory overbooking prevention (inventory lock on booking transaction)
- ✅ Addons system works
- ✅ Coupons works
- ✅ Razorpay order created server-side
- ✅ Razorpay signature verification server-side
- ✅ Payment stored in dedicated payments collection
- ✅ Booking confirmed only after verification
- ✅ Advance payment + due tracking
- ✅ User dashboard bookings + invoice number + cancel
- ✅ Cancellation/refund tracking statuses
- ❌ Reviews (post-completion only)
- ❌ Support ticket system
- ❌ CMS pages editable by admin
- ❌ Notification templates
- ❌ Audit logs for admin actions
- ✅ System settings panel works

## B) UX / UI Coverage

- ✅ Mobile responsive layouts present on core pages
- ✅ Loading/empty/error states implemented on key admin and user pages
- ✅ Form validations (required fields/basic validation)
- ❌ Accessibility baseline incomplete (limited ARIA/error semantics beyond labels)
- ✅ Navigation separation for user and admin works

## Key Fixed Issues During Audit

1. Razorpay flow was client-trusted and allowed booking without server signature verification.
   - Fixed with server routes:
     - `app/api/payments/create-order/route.ts`
     - `app/api/payments/verify/route.ts`
   - Checkout now confirms booking only after verification success.

2. Firestore rules had hardcoded admin email and weak blocked-user enforcement.
   - Fixed role-based admin checks and blocked-user restrictions in `firestore.rules`.

3. Availability block creation used random doc IDs, breaking lock consistency.
   - Fixed in `lib/firebase-db.ts` by writing lock docs to deterministic `listingId_date_slotId` IDs.

4. Settings write path could create random docs instead of updating global settings.
   - Fixed `updateSettings()` to `setDoc(settings/global, merge=true)`.

5. Production build was failing on `/explore` due missing Suspense around `useSearchParams`.
   - Fixed in `app/explore/page.tsx`; build now passes.

6. Pricing tampering risk in checkout (client-sent payable amount) was possible.
   - Fixed with server-authoritative booking intent flow:
     - `app/api/bookings/create-intent/route.ts`
     - `app/api/payments/verify/route.ts` (intent-bound verification)
     - `app/api/bookings/finalize/route.ts` (server-side booking + payment write)
   - Checkout now uses intent -> verify -> finalize sequence.

## Known Limitations (Post-Fix)

- No dedicated `refunds`, `tickets`, `reviews`, `cmsPages`, `auditLogs`, `notifications` domain modules yet.
- Razorpay key secret is expected from secure server env (`RAZORPAY_KEY_SECRET`), not from public settings doc.
