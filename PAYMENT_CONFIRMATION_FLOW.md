# Payment Confirmation Flow

## Server-Side Sequence
1. Frontend calls `verifyPaymentAndConfirmBooking` after Razorpay success.
2. Cloud Function verifies Razorpay signature and order amount.
3. Firestore transaction allocates availability (`reservations`) atomically.
4. Function writes `payments`, `invoices`, and `bookings` in one consistent flow.
5. Booking is marked `confirmed` only after allocation + invoice record creation.
6. Invoice PDF is generated and stored.
7. SMTP confirmation email is sent and status is written to booking/invoice.

## Idempotency
- If intent is already consumed, function returns existing booking/invoice data.
- Duplicate retries do not create duplicate bookings/payments/invoices/reservations.
- Email resend path is controlled separately with explicit admin action.

## Failure Handling
- Allocation conflict marks intent as `manual_resolution`.
- Booking is not confirmed when allocation fails.
- If email fails after confirmation, booking remains confirmed and `emailStatus=failed`.
