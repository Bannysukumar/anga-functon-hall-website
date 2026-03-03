# Checkout Lifecycle Test Checklist

- [ ] User can checkout only their own booking and only for eligible statuses.
- [ ] User checkout from booking details updates status to `checked_out`.
- [ ] Admin can mark check-in on confirmed bookings.
- [ ] Admin can mark check-out / force check-out and audit log is created.
- [ ] Scheduler auto-checks out due bookings (`scheduledCheckOutAt <= now`).
- [ ] Repeated checkout calls are idempotent and do not duplicate side effects.
- [ ] Reservation docs for booking are marked `COMPLETED` on checkout.
- [ ] Checkout SMTP email sends and `checkoutEmailStatus` is updated.
- [ ] Admin can resend checkout email for checked-out booking.
- [ ] Booking detail page shows `Auto checkout at` label.
