# Auto Allocation Test Checklist

## Concurrency and Double Allocation
- [ ] Create two users and one room/slot with capacity `1`.
- [ ] Start checkout concurrently for both users on same date/slot.
- [ ] Complete payment for both.
- [ ] Verify only one booking reaches `status = confirmed`.
- [ ] Verify second request returns allocation conflict or pending-manual state.

## Room / Bed / Slot Allocation
- [ ] For room listing with `units` subcollection (`Room 101`, `Room 102`), confirm allocated labels are persisted in `booking.allocatedResource.labels`.
- [ ] For dormitory with bed units, confirm allocated bed labels and reservation docs are created.
- [ ] For slot-based listings, confirm reservation doc id format `{listingId}_{dateKey}_{slotId}` is updated and quantity bounded by inventory.
- [ ] For tours with capacity, confirm seat quantity allocation is bounded and stored.

## Payment + Signature + Amount Validation
- [ ] Tamper `razorpaySignature` and confirm function rejects request.
- [ ] Tamper order/payment pair and confirm function rejects request.
- [ ] Ensure order amount fetched from Razorpay equals server-side `bookingIntent.razorpayAmount`.

## Invoice
- [ ] Confirm invoice document is created with unique `invoiceNumber`.
- [ ] Confirm invoice PDF is generated and `invoicePdfPath` is written to `invoices/{invoiceId}`.
- [ ] Confirm `booking.invoiceId` and `booking.invoiceNumber` are populated.

## Invoice Security
- [ ] User A can read only their own invoice document via Firestore rules.
- [ ] User B cannot read User A invoice document.
- [ ] Admin can read all invoices.

## Email
- [ ] Confirm `emailStatus` transitions to `sent` when SMTP configuration exists.
- [ ] Confirm fallback `emailStatus = pending/failed` if SMTP config is absent/invalid.
- [ ] Validate admin `Resend Email` action updates email status.

## Idempotency
- [ ] Call `verifyPaymentAndConfirmBooking` twice with same payload.
- [ ] Verify second call returns success with `idempotent = true`.
- [ ] Verify no duplicate `payments`, `invoices`, `reservations`, or extra allocation.
