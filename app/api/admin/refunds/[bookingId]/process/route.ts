import { NextResponse } from "next/server"
import { Timestamp } from "firebase-admin/firestore"
import Razorpay from "razorpay"
import { adminDb } from "@/lib/server/firebase-admin"
import { requirePermission, toHttpError } from "@/lib/server/permission-check"
import { sendRefundEmail } from "@/lib/server/refund-email"
import { calculateRefundAmount } from "@/lib/server/refund-policy"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  let uid: string
  try {
    const result = await requirePermission(request, "REFUNDS_MANAGE")
    uid = result.uid
  } catch (error) {
    const mapped = toHttpError(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
  try {
    const { bookingId } = await params
    const ref = adminDb.collection("bookings").doc(bookingId)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 })
    }
    const data = snap.data() || {}
    if (String(data.status || "") !== "cancelled") {
      return NextResponse.json({ error: "Booking is not cancelled." }, { status: 409 })
    }
    const paymentMethod = String(data.paymentMethod || "").trim() || (String(data.razorpayPaymentId || "").trim() ? "online" : "cash")
    if (paymentMethod !== "online") {
      return NextResponse.json({ error: "Use Mark Refund Completed for cash/offline payments." }, { status: 400 })
    }
    const razorpayPaymentId = String(data.razorpayPaymentId || "").trim()
    if (!razorpayPaymentId) {
      return NextResponse.json({ error: "No online payment ID found for this booking." }, { status: 400 })
    }
    const rs = String(data.refundStatus || "")
    if (rs !== "refund_requested" && rs !== "requested" && rs !== "approved") {
      return NextResponse.json({ error: "Refund cannot be processed in current state." }, { status: 409 })
    }
    let refundAmount = Math.max(0, Number(data.refundAmount || 0))
    const advancePaid = Math.max(0, Number(data.advancePaid || 0))
    if (refundAmount <= 0 && advancePaid > 0) {
      const settingsSnapRef = await adminDb.collection("settings").doc("global").get()
      const settingsRef = (settingsSnapRef.data() || {}) as { refundPolicyRules?: Array<{ daysBefore: number; percent: number }> }
      const rules = Array.isArray(settingsRef.refundPolicyRules) && settingsRef.refundPolicyRules.length > 0 ? settingsRef.refundPolicyRules : undefined
      const { amount } = calculateRefundAmount(advancePaid, data.checkInDate, rules)
      refundAmount = amount
    }
    if (refundAmount <= 0) {
      return NextResponse.json({ error: "Refund amount is zero." }, { status: 400 })
    }
    const amountInPaise = Math.round(refundAmount * 100)
    const [settingsSnap, secureSnap] = await Promise.all([
      adminDb.collection("settings").doc("global").get(),
      adminDb.collection("secureSettings").doc("razorpay").get(),
    ])
    const settings = (settingsSnap.data() || {}) as { razorpayKeyId?: string }
    const secure = (secureSnap.data() || {}) as { razorpaySecretKey?: string; razorpayKeyId?: string }
    const keyId = String(settings.razorpayKeyId || secure.razorpayKeyId || process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "").trim()
    const secret = String(secure.razorpaySecretKey || process.env.RAZORPAY_KEY_SECRET || "").trim()
    if (!keyId || !secret) {
      return NextResponse.json({ error: "Razorpay not configured. Set Key ID and Secret in Admin > Settings." }, { status: 500 })
    }
    const razorpay = new Razorpay({ key_id: keyId, key_secret: secret })
    const refundResponse = await (razorpay.payments as { refund: (id: string, opts: { amount: number; notes?: Record<string, string> }) => Promise<{ id: string }> }).refund(razorpayPaymentId, {
      amount: amountInPaise,
      notes: { bookingId },
    })
    const gatewayRefundId = refundResponse?.id ? String(refundResponse.id) : null
    await ref.set(
      {
        refundStatus: "refunded",
        paymentStatus: "refunded",
        refundAmount,
        refundDate: Timestamp.now(),
        refundProcessedBy: uid,
        ...(gatewayRefundId ? { gatewayRefundId } : {}),
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    )
    await adminDb.collection("auditLogs").add({
      entity: "booking",
      entityId: bookingId,
      action: "REFUND_PROCESSED",
      message: "Online refund processed via gateway",
      payload: { gatewayRefundId },
      createdBy: uid,
      createdAt: Timestamp.now(),
    })
    const payload = { ...data, refundStatus: "refunded", refundAmount }
    try {
      await sendRefundEmail("REFUND_COMPLETED", bookingId, payload)
    } catch (e) {
      console.error("Refund completed email failed", e)
    }
    return NextResponse.json({ ok: true, refundStatus: "refunded", gatewayRefundId: gatewayRefundId || undefined })
  } catch (error) {
    const err = error as { message?: string; error?: { description?: string } }
    if (err.message === "FORBIDDEN" || err.message === "UNAUTHORIZED") {
      const mapped = toHttpError(error)
      return NextResponse.json({ error: mapped.error }, { status: mapped.status })
    }
    const gatewayError = err.error?.description || err.message || "Gateway refund failed"
    console.error("Refund process error", error)
    return NextResponse.json({ error: gatewayError }, { status: 500 })
  }
}
