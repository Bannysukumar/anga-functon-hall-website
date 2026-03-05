# Check-in / Check-out Rule System – Test Instructions

## Prerequisites

- Admin: set **Check-in time** and **Check-out time** in **Admin → Settings → Check-in & Check-out (system defaults)** (e.g. Check-in: 12:00, Check-out: 11:00).
- Ensure at least one **Confirmed** booking whose event date is today (for time-based tests).

---

## Test 1: Check-in before allowed time → should fail

1. Set admin check-in time to a time **after** current time (e.g. 11:00 PM if it’s morning).
2. As **receptionist** or **customer**, open a **Confirmed** booking for today.
3. Click **Check-in**.
4. **Expected:** Error (e.g. “Check-in is not allowed before the scheduled check-in time” or 409). Booking remains **Confirmed**.

---

## Test 2: Check-in after allowed time → success

1. Set admin check-in time to a time **before** current time (e.g. 12:00 AM or 06:00).
2. As receptionist or customer, open a **Confirmed** booking for today.
3. Click **Check-in**.
4. **Expected:** Success. Status becomes **Checked-in**. “Actual check-in” timestamp is shown.

---

## Test 3: Cancel after check-in → blocked

1. Use a booking that is **Checked-in** (from Test 2 or created and checked in).
2. As **receptionist**: on the booking, **Cancel** button must not be shown (only Pending/Confirmed show Cancel).
3. As **customer**: on **Dashboard → Booking details**, **Cancel Booking** must not be shown.
4. If you force a cancel request (e.g. via API), **Expected:** 409 with message that cancel is only allowed for Pending or Confirmed.

---

## Test 4: Manual check-out → success

1. Use a **Checked-in** booking.
2. As receptionist, click **Check-out** (with optional notes).
3. **Expected:** Status becomes **Checked-out**. “Actual check-out” timestamp is stored. Check-out button no longer shown.
4. As **customer**, open the same booking; **Check Out** button should appear when status is **Checked-in**. After clicking, status becomes **Checked-out**.

---

## Test 5: No manual check-out → system auto-checkout after admin check-out time

1. Deploy Firebase Functions so **scheduledAutoCheckoutJob** runs (every 10 minutes).
2. Create a **Checked-in** booking whose **scheduled check-out time** (from listing or system default) is in the past or will be in the past before the next run.
3. Do **not** click Check-out.
4. Wait for the next scheduler run (or trigger it).
5. **Expected:** Booking status becomes **Checked-out**, `checkOutAt` set, `checkoutMethod` = `"AUTO"`.

---

## Validation rules (quick checks)

- **Check-in before allowed time:** Rejected (receptionist PATCH check_in and user POST /api/bookings/[id]/checkin).
- **Cancel after check-in:** Cancel only allowed for **Pending** and **Confirmed** (receptionist + user cancel API).
- **Double check-in:** Rejected (only **Confirmed** can be checked in; after check-in status is **Checked-in**).
- **Check-out before check-in:** Check-out only allowed when status is **Checked-in** (receptionist PATCH and user checkout).

---

## UI checklist

**Receptionist → Bookings**

- **Pending / Confirmed:** Show **Check-in**, **Cancel booking**. Do not show **Check-out**.
- **Checked-in:** Show **Check-out** only. No Cancel.
- **Checked-out:** No Check-in / Check-out / Cancel. Show “Actual check-in” and “Actual check-out” when available.
- Each booking row shows: Check-in time, Check-out time, Actual check-in, Actual check-out.

**User Dashboard → Booking details**

- **Confirmed** and current time ≥ scheduled check-in: Show **Check In**.
- **Confirmed** and current time &lt; scheduled check-in: Show message “Check-in will be available after …”.
- **Checked-in:** Show **Check Out** only. No Cancel.
- **Checked-out:** No actions. Show Actual check-in and Actual check-out if present.
- **Pending / Confirmed:** Show **Cancel Booking**. **Checked-in / Checked-out:** Cancel hidden.
