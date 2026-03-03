# FLOW_AUDIT

## User Flow Tests (Code Trace)

1. Signup -> login -> browse -> choose listing -> date/slot -> coupon -> pay -> booking in dashboard
   - Status: ✅ Pass (core flow implemented)
   - Notes:
     - signup/login/forgot present
     - listing browse/details present
     - coupon apply logic present
     - payment now uses server order + server signature verify
     - booking persisted and visible in dashboard

2. Payment fail -> booking not confirmed -> slot lock released/expired
   - Status: ✅ Pass
   - Notes:
     - booking is not created on payment failure
     - server finalize runs only after successful verify
     - lock write occurs at finalize, so no stale pre-payment lock is created

3. Cancel booking -> status updated -> refund tracking created
   - Status: ✅ Pass (basic)
   - Notes:
     - user cancel path updates status + refund request fields
     - admin can approve refund status in admin bookings
     - no dedicated `refunds` collection or payout workflow

4. Create support ticket -> admin reply visible
   - Status: ❌ Fail (feature not implemented)

5. Review allowed only after booking completed
   - Status: ❌ Fail (reviews module not implemented)

## Admin Flow Tests (Code Trace)

1. Admin login restriction
   - Status: ✅ Pass
   - Notes:
     - admin guard + role/claim checks in auth/rules

2. Create listing with photos + addons + slots
   - Status: ✅ Pass

3. Block dates/slots prevents booking
   - Status: ✅ Pass after lock ID fix in `setAvailabilityBlock()`

4. Update pricing reflected on listing page
   - Status: ✅ Pass

5. Change booking status logs audit entry
   - Status: ❌ Fail (no auditLogs write implemented)

6. Export bookings/payments
   - Status: ❌ Fail (not implemented)
