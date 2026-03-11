import { NextResponse } from "next/server"
import { Timestamp } from "firebase-admin/firestore"
import { adminDb } from "@/lib/server/firebase-admin"
import { verifyRazorpayWebhookSignature } from "@/lib/server/razorpay-webhook"
import { createBookingFromIntent } from "@/lib/server/create-booking-from-intent"

const WEBHOOK_EVENTS = ["payment.captured", "payment.failed"] as const

async function getWebhookSecret(): Promise<string> {
  const snap = await adminDb.collection("secureSettings").doc("razorpay").get()
  const data = snap.data() as { razorpayWebhookSecret?: string } | undefined
  const secret = data?.razorpayWebhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || ""
  return secret.trim()
}

export async function POST(request: Request) {
  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const signature = request.headers.get("X-Razorpay-Signature") || ""
  const webhookSecret = await getWebhookSecret()
  if (!webhookSecret) {
    console.error("[Razorpay Webhook] Webhook secret not configured. Set RAZORPAY_WEBHOOK_SECRET or razorpayWebhookSecret in secureSettings.")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 })
  }

  if (!verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
    console.warn("[Razorpay Webhook] Invalid signature")
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  let payload: { event: string; payload?: { payment?: { entity?: { id?: string; order_id?: string; status?: string } } } }
  try {
    payload = JSON.parse(rawBody) as typeof payload
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const event = payload?.event
  if (!event || !WEBHOOK_EVENTS.includes(event as (typeof WEBHOOK_EVENTS)[number])) {
    return NextResponse.json({ received: true })
  }

  const paymentEntity = payload?.payload?.payment?.entity
  const orderId = paymentEntity?.order_id ? String(paymentEntity.order_id) : ""
  const paymentId = paymentEntity?.id ? String(paymentEntity.id) : ""

  await adminDb.collection("webhookLogs").add({
    event,
    orderId,
    paymentId,
    raw: rawBody.slice(0, 2000),
    createdAt: Timestamp.now(),
  })

  if (event === "payment.failed") {
    const intentSnap = await adminDb
      .collection("bookingIntents")
      .where("razorpayOrderId", "==", orderId)
      .limit(1)
      .get()
    if (!intentSnap.empty) {
      const intentRef = intentSnap.docs[0].ref
      const intent = intentSnap.docs[0].data()
      if (intent?.status !== "consumed") {
        await intentRef.update({
          status: "payment_failed",
          paymentFailedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        })
      }
    }
    return NextResponse.json({ received: true })
  }

  if (event === "payment.captured") {
    if (!orderId || !paymentId) {
      return NextResponse.json({ error: "Missing order_id or payment id" }, { status: 400 })
    }
    const intentSnap = await adminDb
      .collection("bookingIntents")
      .where("razorpayOrderId", "==", orderId)
      .limit(1)
      .get()
    if (intentSnap.empty) {
      console.warn("[Razorpay Webhook] No intent found for order_id:", orderId)
      return NextResponse.json({ received: true })
    }
    const intentDoc = intentSnap.docs[0]
    const intentId = intentDoc.id
    const intent = intentDoc.data()
    if (intent?.status === "consumed" && intent?.bookingId) {
      return NextResponse.json({ received: true, bookingId: intent.bookingId })
    }
    if (intent?.status !== "verified") {
      await intentDoc.ref.update({
        status: "verified",
        razorpayPaymentId: paymentId,
        verifiedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
    }
    const userId = String(intent?.userId || "")
    if (!userId) {
      console.error("[Razorpay Webhook] Intent has no userId:", intentId)
      return NextResponse.json({ error: "Intent invalid" }, { status: 400 })
    }
    try {
      const result = await createBookingFromIntent(intentId, orderId, paymentId, userId)
      return NextResponse.json({ received: true, bookingId: result.bookingId })
    } catch (err) {
      console.error("[Razorpay Webhook] createBookingFromIntent failed:", err)
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Booking creation failed" },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ received: true })
}
