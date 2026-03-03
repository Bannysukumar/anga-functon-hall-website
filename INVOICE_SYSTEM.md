# Invoice System

## What Gets Created
- `invoices/{invoiceId}` with invoice number, booking link, customer details, breakdown, payment refs.
- `invoicePdfPath` saved after PDF generation in Cloud Functions.
- `booking.invoiceId` and `booking.invoiceNumber` for user/admin visibility.

## PDF Strategy
- PDF generated server-side inside Cloud Functions.
- Stored at `invoices/{invoiceId}.pdf` in Firebase Storage.
- Public storage reads are blocked for invoices.
- Download uses callable `getInvoiceDownloadUrl` that returns a short-lived signed URL.

## Access Control
- User can access only their own invoice.
- Admin can access any invoice.
- No client write access to invoice or payment records.

## Email Integration
- SMTP confirmation email includes booking + allocation + amount details.
- PDF is attached when available.
- Template placeholders come from `settings/global` fields:
  - `bookingEmailSubjectTemplate`
  - `bookingEmailHtmlTemplate`
