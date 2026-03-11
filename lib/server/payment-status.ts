import Razorpay from "razorpay"
import { Timestamp } from "firebase-admin/firestore"
import { adminDb } from "@/lib/server/firebase-admin"
import { createBookingFromIntent } from "@/lib/server/create-booking-from-intent"

type PaymentState = "paid" | "pending" | "failed" | "not_found"

function toDate(value: unknown): Date | null {
  if (!value) return null
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const maybe = (value as { toDate?: () => Date }).toDate?.()
    if (maybe instanceof Date && !Number.isNaN(maybe.getTime())) return maybe
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  return null
}

async function getRazorpayClient() {
  const [settingsSnap, secureSnap] = await Promise.all([
    adminDb.collection("settings").doc("global").get(),
    adminDb.collection("secureSettings").doc("razorpay").get(),
  ])
  const keyId = String(
    settingsSnap.data()?.razorpayKeyId ||
      secureSnap.data()?.razorpayKeyId ||
      process.env.RAZORPAY_KEY_ID ||
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
      ""
  ).trim()
  const keySecret = String(
    secureSnap.data()?.razorpaySecretKey || process.env.RAZORPAY_KEY_SECRET || ""
  ).trim()
  if (!keyId || !keySecret) return null
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  })
}

export async function resolvePaymentByOrderId(orderId: string): Promise<{
  paymentStatus: PaymentState
  status: string
  intentId?: string
  bookingId?: string
  invoiceNumber?: string
}> {
  const normalized = String(orderId || "").trim()
  if (!normalized) return { paymentStatus: "not_found", status: "missing_order" }

  const intentSnap = await adminDb
    .collection("bookingIntents")
    .where("razorpayOrderId", "==", normalized)
    .limit(1)
    .get()
  if (intentSnap.empty) {
    const bookingSnap = await adminDb
      .collection("bookings")
      .where("razorpayOrderId", "==", normalized)
      .limit(1)
      .get()
    if (!bookingSnap.empty) {
      const bookingDoc = bookingSnap.docs[0]
      const booking = bookingDoc.data() || {}
      const status = String(booking.status || "pending")
      const paymentStatus = String(booking.paymentStatus || "pending")
      if (paymentStatus === "paid" || paymentStatus === "advance_paid" || status === "confirmed") {
        return {
          paymentStatus: "paid",
          status: "consumed",
          bookingId: bookingDoc.id,
          invoiceNumber: String(booking.invoiceNumber || ""),
        }
      }
    }
    return { paymentStatus: "not_found", status: "not_found" }
  }

  const intentDoc = intentSnap.docs[0]
  const intentId = intentDoc.id
  const intent = intentDoc.data() || {}
  const currentStatus = String(intent.status || "created")
  const bookingId = String(intent.bookingId || "")

  if (currentStatus === "consumed" && bookingId) {
    const booking = await adminDb.collection("bookings").doc(bookingId).get()
    return {
      paymentStatus: "paid",
      status: currentStatus,
      intentId,
      bookingId,
      invoiceNumber: String(booking.data()?.invoiceNumber || ""),
    }
  }
  if (currentStatus === "payment_failed") {
    return { paymentStatus: "failed", status: currentStatus, intentId, bookingId }
  }

  const expiresAt = toDate(intent.expiresAt)
  if (expiresAt && Date.now() > expiresAt.getTime()) {
    await intentDoc.ref.set(
      {
        status: "payment_failed",
        paymentFailedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    )
    if (bookingId) {
      await adminDb
        .collection("bookings")
        .doc(bookingId)
        .set(
          {
            status: "cancelled",
            paymentStatus: "failed",
            cancellationReason: "Payment timed out after 30 minutes.",
            cancelledAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        )
    }
    return { paymentStatus: "failed", status: "payment_failed", intentId, bookingId }
  }

  const razorpay = await getRazorpayClient()
  if (!razorpay) {
    return { paymentStatus: "pending", status: currentStatus, intentId, bookingId }
  }

  try {
    const order = (await razorpay.orders.fetch(normalized)) as {
      status?: string
      amount_paid?: number
      amount_due?: number
    }
    const amountPaid = Number(order?.amount_paid || 0)
    const orderStatus = String(order?.status || currentStatus)

    if (amountPaid > 0 || orderStatus === "paid") {
      const payments = (await razorpay.orders.fetchPayments(normalized)) as {
        items?: Array<{ id?: string; status?: string }>
      }
      const capturedPayment =
        payments?.items?.find((item) => String(item.status || "").toLowerCase() === "captured") ||
        payments?.items?.[0]
      const paymentId = String(capturedPayment?.id || intent.razorpayPaymentId || "")
      const userId = String(intent.userId || "")
      if (!paymentId || !userId) {
        return { paymentStatus: "pending", status: currentStatus, intentId, bookingId }
      }
      await intentDoc.ref.set(
        {
          status: "verified",
          razorpayPaymentId: paymentId,
          verifiedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      )
      const confirmed = await createBookingFromIntent(intentId, normalized, paymentId, userId)
      return {
        paymentStatus: "paid",
        status: "consumed",
        intentId,
        bookingId: confirmed.bookingId,
        invoiceNumber: confirmed.invoiceNumber,
      }
    }
  } catch {
    // keep pending fallback when gateway fetch is temporarily unavailable
  }

  return { paymentStatus: "pending", status: currentStatus, intentId, bookingId }
}
