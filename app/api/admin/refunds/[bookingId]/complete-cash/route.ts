import { NextResponse } from "next/server"
import { Timestamp } from "firebase-admin/firestore"
import { adminDb } from "@/lib/server/firebase-admin"
import { requirePermission, toHttpError } from "@/lib/server/permission-check"
import { sendRefundEmail } from "@/lib/server/refund-email"

const REFUND_METHODS = ["cash", "upi", "bank_transfer"] as const

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
    const body = await request.json().catch(() => ({}))
    const refundMethod = String(body?.refund_method || body?.refundMethod || "").trim().toLowerCase()
    if (!REFUND_METHODS.includes(refundMethod as (typeof REFUND_METHODS)[number])) {
      return NextResponse.json(
        { error: "Invalid refund_method. Use: cash, upi, or bank_transfer" },
        { status: 400 }
      )
    }
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
    if (paymentMethod === "online") {
      return NextResponse.json({ error: "Use Process Refund for online payments." }, { status: 400 })
    }
    const rs = String(data.refundStatus || "")
    if (rs !== "refund_requested" && rs !== "requested" && rs !== "approved") {
      return NextResponse.json({ error: "Refund cannot be completed in current state." }, { status: 409 })
    }
    const effectiveRefundAmount = Number(data.refundAmount || 0) || Number(data.advancePaid || 0)
    await ref.set(
      {
        refundStatus: "refunded",
        paymentStatus: "refunded",
        refundMethod: refundMethod as "cash" | "upi" | "bank_transfer",
        refundDate: Timestamp.now(),
        refundProcessedBy: uid,
        ...(effectiveRefundAmount > 0 ? { refundAmount: effectiveRefundAmount } : {}),
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    )
    await adminDb.collection("auditLogs").add({
      entity: "booking",
      entityId: bookingId,
      action: "REFUND_COMPLETED_CASH",
      message: `Manual refund completed via ${refundMethod}`,
      payload: { refundMethod },
      createdBy: uid,
      createdAt: Timestamp.now(),
    })
    const payload = {
      ...data,
      refundStatus: "refunded",
      refundMethod,
      refundAmount: effectiveRefundAmount,
    }
    try {
      await sendRefundEmail("REFUND_COMPLETED", bookingId, payload)
    } catch (e) {
      console.error("Refund completed email failed", e)
    }
    return NextResponse.json({ ok: true, refundStatus: "refunded" })
  } catch (error) {
    if ((error as { message?: string }).message === "FORBIDDEN" || (error as { message?: string }).message === "UNAUTHORIZED") {
      const mapped = toHttpError(error)
      return NextResponse.json({ error: mapped.error }, { status: mapped.status })
    }
    console.error("Complete cash refund error", error)
    return NextResponse.json({ error: "Failed to mark refund completed" }, { status: 500 })
  }
}
