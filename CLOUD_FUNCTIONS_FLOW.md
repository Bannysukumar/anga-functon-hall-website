# Cloud Functions Booking Flow

## `verifyPaymentAndConfirmBooking` (Callable)

Order of execution:

1. Validate auth and required payload.
2. Fetch booking intent and ensure it belongs to caller.
3. Idempotency short-circuit:
   - If intent already `consumed`, return existing booking details.
4. Verify Razorpay signature server-side (`HMAC SHA256`).
5. Fetch Razorpay order and ensure paid amount equals server intent amount.
6. Firestore transaction:
   - Re-read intent and guard state.
   - Re-read user/listing/branch and user-block status.
   - Allocate resources (units/slots/inventory) with reservation docs.
   - Create payment record.
   - Increment invoice counter and create invoice record.
   - Create confirmed booking record with allocation + invoice references.
   - Mark intent consumed.
   - Increment coupon usage when applicable.
7. Post-transaction:
   - Generate invoice PDF and upload to Storage.
   - Save `invoicePdfPath` on invoice.
   - Send confirmation email over SMTP and persist `emailStatus`.
8. Return confirmed booking/invoice/allocation payload.

## `processInvoiceCreated` (Firestore Trigger)

Fallback background job:
- Triggers on `invoices/{invoiceId}` creation.
- Generates invoice PDF if missing.
- Writes `invoicePdfPath` back to invoice doc.

## `resendBookingConfirmationEmail` (Callable, Admin Only)

1. Validate auth and admin role.
2. Fetch booking + linked invoice.
3. Send email again.
4. Update `emailStatus` on invoice and booking.

## `getInvoiceDownloadUrl` (Callable)

1. Validate auth and input invoice id.
2. Load invoice and caller user profile.
3. Permit only invoice owner or admin.
4. Generate a short-lived signed URL (15 minutes).
5. Return URL to client for secure download.

## Environment Variables

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM_NAME`
- `SMTP_FROM_EMAIL`
- `APP_BASE_URL`
- `ADMIN_NOTIFICATION_EMAIL` (optional)

## Security Notes

- Allocation, payment verification, invoice creation happen server-side only.
- Firestore rules block direct client writes to `reservations` and `invoices`.
- Booking status reaches confirmed only from server transaction path.
