# SMTP Email Test Checklist

- [ ] Configure all SMTP environment variables in Cloud Functions.
- [ ] Complete a successful Razorpay payment for a test booking.
- [ ] Verify booking status becomes `confirmed`.
- [ ] Verify allocation details are present in `booking.allocatedResource`.
- [ ] Verify invoice is created with `invoiceNumber` and `invoicePdfPath`.
- [ ] Verify `emailStatus` becomes `sent` and `emailLogs` has a `SENT` entry.
- [ ] Turn off SMTP credentials and retry: verify `emailStatus` becomes `pending` or `failed`.
- [ ] Use admin "Resend Email": verify status update and new email log entry.
- [ ] Call verification twice for same payment: verify no duplicate allocations/payments/invoices/emails.
- [ ] Open `/invoice/{invoiceId}` as owner user: download should work.
- [ ] Open `/invoice/{invoiceId}` as another non-admin user: access should fail.
