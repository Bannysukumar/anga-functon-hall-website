# Razorpay Webhook & Mobile Payment Flow

This document describes the Razorpay webhook integration and how payment status is updated when the user pays via UPI (including mobile redirect flow).

## Problem

On mobile, when the user completes payment in the UPI app and returns to the browser, the frontend Razorpay handler may not run. The booking stayed in "Pay" state because the server never received payment confirmation.

## Solution

1. **Webhook as source of truth** – Razorpay sends `payment.captured` and `payment.failed` to our backend. The server updates the booking from the webhook.
2. **Payment status API** – After redirect, the frontend polls `GET /api/bookings/payment-status?orderId=...` to show success or failure.
3. **Checkout page** – Before opening Razorpay, we store `pendingPaymentOrderId` in sessionStorage. On load, if that key exists, we poll payment-status and show "Checking payment status...", then either redirect to success or show "Payment Failed" + Retry.

---

## 1. Webhook Endpoint

**URL:** `POST /api/payments/webhook/razorpay`

- **Signature:** Verified using `X-Razorpay-Signature` and the **webhook secret** (not the API secret). The raw request body must be used for verification.
- **Events handled:**
  - `payment.captured` – Find intent by `order_id`, set intent to verified + `razorpayPaymentId`, then create booking (same logic as finalize) and send confirmation email.
  - `payment.failed` – Find intent by `order_id`, set intent status to `payment_failed`.

### Configure in Razorpay Dashboard

1. Go to **Settings → Webhooks**.
2. Add URL: `https://your-domain.com/api/payments/webhook/razorpay`.
3. Select events: **payment.captured**, **payment.failed**.
4. Copy the **Webhook Secret** (e.g. `whsec_...`).

### Configure in App

- **Option A:** Admin → Settings → Razorpay → set **Razorpay Webhook Secret** and save.
- **Option B:** Set env `RAZORPAY_WEBHOOK_SECRET=whsec_...`.

---

## 2. Database Fields

Bookings and intents use (or are set by the webhook):

| Field | Description |
|-------|-------------|
| `razorpay_order_id` | Stored as `razorpayOrderId` on intent and booking. |
| `razorpay_payment_id` | Stored as `razorpayPaymentId` on intent and booking. |
| `razorpay_signature` | Used only at verify/finalize on the frontend; not stored for webhook-created bookings. |
| `payment_status` | `paid` / `advance_paid` when payment is captured. |
| `paid_at` | Timestamp when payment was captured (set on booking). |

Intent statuses: `created` → `verified` (after payment) → `consumed` (after booking created). For failed payments: `payment_failed`.

---

## 3. Payment Status API

**GET** `/api/bookings/payment-status?orderId=<razorpay_order_id>`

- No auth required (used after redirect).
- Returns:
  - `status` – Intent status: `created`, `verified`, `consumed`, `payment_failed`, `not_found`.
  - `paymentStatus` – `pending` | `paid` | `failed`.
  - `bookingId` – Present when `paymentStatus === "paid"`.
  - `invoiceNumber`, `intentId` – When available.

---

## 4. Frontend Flow

1. User clicks **Pay** → we store `pendingPaymentOrderId`, `pendingPaymentIntentId`, pricing and listing title in sessionStorage and open Razorpay.
2. **Same-tab success:** Razorpay handler runs → verify + finalize (or Firebase callable) → clear pending keys → set `bookingConfirmation` → redirect to `/checkout/success`.
3. **Redirect (e.g. UPI app):** User returns to site (checkout or any page). Checkout page load reads `pendingPaymentOrderId`:
   - If present, show "Checking payment status..." and poll `GET /api/bookings/payment-status?orderId=...` every 2s (up to ~60s).
   - If `paymentStatus === "paid"` and `bookingId` → set `bookingConfirmation` from pricing + listing title → redirect to `/checkout/success`.
   - If `paymentStatus === "failed"` or `status === "payment_failed"` → show "Payment Failed" and "Retry Payment" (clears pending; user can click Pay again).

Success page can also load by `?bookingId=...` and fetch booking details if sessionStorage confirmation is missing.

---

## 5. Logging

- Webhook requests are logged to the `webhookLogs` collection (event, orderId, paymentId, raw body snippet).
- Invalid signature or missing secret is logged to console.

---

## 6. Testing

### Test 1: UPI on mobile → success → booking updated

1. On mobile, go to checkout and click Pay.
2. Complete payment in UPI app and return to the browser (or close Razorpay and rely on webhook).
3. Checkout page should show "Checking payment status..." then redirect to success.
4. In Firestore: booking exists, `paymentStatus` = `advance_paid` or `paid`, `paidAt` set; intent status = `consumed`.

### Test 2: Payment cancelled → failed

1. Start payment, then cancel or fail in Razorpay/UPI.
2. Return to site; either handler reports failure or polling sees `payment_failed`.
3. UI shows "Payment Failed" and "Retry Payment"; no booking created; intent status = `payment_failed`.

### Test 3: Webhook triggers → booking updated

1. In Razorpay Dashboard → Webhooks, send a test event `payment.captured` (or use a test payment).
2. Ensure webhook URL is reachable and secret is correct.
3. Verify intent is found by `order_id`, booking is created, and `payment_status` / `paid_at` are set.

---

## Idempotency

- If the webhook receives `payment.captured` for an intent already `consumed`, it returns 200 without creating a duplicate booking.
- If the frontend calls finalize after the webhook has already created the booking, finalize detects `status === "consumed"` and returns the existing booking.
