# Allocation and Invoice Data Model

## Booking Intent
`bookingIntents/{intentId}`
- `userId`, `listingId`, `branchId`
- `checkInDate`, `slotId`, `slotName`
- `guestCount`, `unitsBooked`, `selectedAddons`
- `pricing` (server-calculated)
- `razorpayOrderId`, `razorpayAmount`
- `status`: `created | verified | consumed`
- `bookingId`, `paymentId`, `invoiceId`, `invoiceNumber`

## Reservations
`reservations/{reservationId}`
- `listingId`, `bookingId`, `userId`
- `dateKey` (`YYYYMMDD`)
- `unitId` (for rooms/beds) OR `slotId` (for slot allocations)
- `quantity` (for inventory/slot based allocations)
- `status = BOOKED`

Reservation ID strategy:
- Slot based: `{listingId}_{dateKey}_{slotId}`
- Unit based: `{unitId}_{dateKey}`
- Quantity fallback: `{listingId}_{dateKey}_inventory`

## Listing Units
`listings/{listingId}/units/{unitId}`
- `label` (Room 101 / Bed 12)
- `active` (`true/false`)

## Payments
`payments/{paymentId}`
- `bookingId`, `userId`, `listingId`, `branchId`
- `amount`, `totalAmount`, `currency`, `status`
- `verified`, `gateway`
- `razorpayOrderId`, `razorpayPaymentId`

## Invoices
`invoices/{invoiceId}`
- `invoiceNumber` (example `INV-2026-000123`)
- `bookingId`, `userId`, `issuedAt`
- `customer` object
- `service` object (listing/date/allocated labels)
- `breakdown` object (base/addons/tax/fee/discount/paid/due)
- `payment` object (Razorpay ids)
- `invoicePdfPath` (Storage path, private)
- `emailStatus` (`pending | sent | failed`)
- `emailSentAt` (server timestamp)

## Email Logs
`emailLogs/{logId}`
- `bookingId`, `invoiceId`
- `toEmail`
- `status` (`SENT | FAILED | NOT_SENT`)
- `error` (optional)
- `messageId` (optional)
- `timestamp`

## Booking Final State
`bookings/{bookingId}`
- `status = confirmed` only after signature verify + allocation + invoice record
- `paymentVerified = true`
- `allocatedResource` with labels/doc ids/date/quantity
- `invoiceId`, `invoiceNumber`
- `emailStatus`
