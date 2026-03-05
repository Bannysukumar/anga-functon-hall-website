# Refund Request and Refund Processing System

## Overview

The system supports full refund workflow for both **online** (gateway) and **offline (cash)** payments.

- **Workflow:** Confirmed → User cancels → Refund requested → Admin review → Approve/Reject → Refund completed (process gateway or mark cash completed).

## Database fields (bookings)

New or extended fields on `bookings`:

| Field | Type | Description |
|-------|------|-------------|
| `refundStatus` | string | `none` \| `refund_requested` \| `approved` \| `rejected` \| `refunded` (legacy: `requested` → refund_requested, `processed` → refunded) |
| `refundAmount` | number | Calculated from policy when user cancels |
| `refundMethod` | string? | For cash refunds: `cash` \| `upi` \| `bank_transfer` |
| `refundDate` | Timestamp? | When refund was completed |
| `refundProcessedBy` | string? | Admin UID who processed |
| `gatewayRefundId` | string? | Gateway refund ID (online) |
| `paymentMethod` | string? | `online` \| `cash` (inferred from `razorpayPaymentId` if not set) |
| `cancellationReason` | string? | Optional reason stored on cancel |

No separate migration script is required: Firestore documents get these fields when they are written (on cancel or refund actions). Existing bookings without these fields are handled with defaults in code.

## Settings: Refund policy rules

In **Admin → Settings**, section **Cancellation refund rules**:

- List of `{ daysBefore, percent }` (e.g. 7 days → 100%, 3 days → 50%, 1 day → 0%).
- Stored in `settings.global.refundPolicyRules`.
- When a user cancels, `refundAmount` is computed from `advancePaid`, event date, and these rules (see `lib/server/refund-policy.ts`).

## APIs

- **POST /api/bookings/[id]/cancel** (user)  
  - Body (optional): `{ "cancellationReason": "..." }`  
  - Sets status → cancelled, refundStatus → refund_requested, computes and sets refundAmount, paymentMethod.

- **GET /api/admin/refunds** (admin)  
  - Query: `?status=all|refund_requested|approved|rejected|refunded`  
  - Returns cancelled bookings with refund data; customer names resolved from `users`.

- **POST /api/admin/refunds/[bookingId]/approve** (admin)  
  - Sets refundStatus → approved; sends REFUND_APPROVED email.

- **POST /api/admin/refunds/[bookingId]/reject** (admin)  
  - Sets refundStatus → rejected; sends REFUND_REJECTED email.

- **POST /api/admin/refunds/[bookingId]/process** (admin)  
  - For **online** only. Calls Razorpay refund API, then sets refunded, refundDate, gatewayRefundId; sends REFUND_COMPLETED email.

- **POST /api/admin/refunds/[bookingId]/complete-cash** (admin)  
  - Body: `{ "refund_method": "cash" | "upi" | "bank_transfer" }`  
  - For **cash** only. Sets refunded, refundMethod, refundProcessedBy, refundDate; sends REFUND_COMPLETED email.

All admin refund routes require `REFUNDS_MANAGE` permission (admin only in default setup).

## UI

- **Admin → Refunds** (`/admin/refunds`): Table of refund requests; filters; actions: View booking, Approve, Reject, Process refund (online), Mark refund completed (cash with method).
- **Admin → Bookings**: “Approve Refund” calls the approve API; full process is on Refunds page.
- **Admin dashboard**: Alert when there are pending refund requests (link to Refunds).
- **User dashboard → Booking detail**: When booking is cancelled, a refund status badge is shown (Refund Requested, Approved, Rejected, Refund Completed).

## Emails

- **BOOKING_CANCELLED**: Sent when user or receptionist cancels (from cancel API and receptionist PATCH).
- **REFUND_APPROVED** / **REFUND_REJECTED** / **REFUND_COMPLETED**: Sent from refund-email module when admin approves, rejects, or completes refund.

## Testing

1. **User cancels booking**  
   - As customer, open a confirmed booking, click Cancel.  
   - Expected: status → cancelled, refundStatus → refund_requested, refundAmount set; BOOKING_CANCELLED email if SMTP configured.

2. **Admin approves refund**  
   - Admin → Refunds (or Bookings), find a refund_requested row, Approve.  
   - Expected: refundStatus → approved; REFUND_APPROVED email.

3. **Online refund processed**  
   - On Refunds page, for an online-payment booking with status refund_requested or approved, use “Process refund (gateway)”.  
   - Expected: Razorpay refund called; booking → refunded, refundDate and gatewayRefundId set; REFUND_COMPLETED email.

4. **Cash refund marked completed**  
   - On Refunds page, for a cash booking, use “Mark refund completed”, choose Cash/UPI/Bank Transfer.  
   - Expected: refundStatus → refunded, refundMethod and refundProcessedBy set; REFUND_COMPLETED email.
