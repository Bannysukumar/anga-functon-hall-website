import { NextResponse } from "next/server"
import { Timestamp } from "firebase-admin/firestore"
import { adminAuth, adminDb } from "@/lib/server/firebase-admin"
import { markReservationsCancelled, releaseBookingAvailability } from "@/lib/server/booking-cancellation"
import { calculateRefundAmount } from "@/lib/server/refund-policy"

function readBearerToken(request: Request) {
  const auth = request.headers.get("authorization") || ""
  if (!auth.startsWith("Bearer ")) return ""
  return auth.slice("Bearer ".length).trim()
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = readBearerToken(request)
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const decoded = await adminAuth.verifyIdToken(token)
    const { id } = await params
    const ref = adminDb.collection("bookings").doc(id)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 })
    }
    const current = snap.data() || {}
    if (String(current.userId || "") !== decoded.uid) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 })
    }
    const status = String(current.status || "")
    if (!["pending", "confirmed"].includes(status)) {
      return NextResponse.json({ error: "Booking cannot be cancelled." }, { status: 409 })
    }

    let cancellationReason = ""
    try {
      const body = await request.json().catch(() => ({}))
      cancellationReason = String(body?.cancellationReason ?? "").trim().slice(0, 500)
    } catch {
      // no body
    }

    const advancePaid = Number(current.advancePaid || 0)
    const settingsSnap = await adminDb.collection("settings").doc("global").get()
    const settings = (settingsSnap.data() || {}) as { refundPolicyRules?: Array<{ daysBefore: number; percent: number }> }
    const rules = Array.isArray(settings.refundPolicyRules) && settings.refundPolicyRules.length > 0
      ? settings.refundPolicyRules
      : undefined
    const { amount: refundAmount } = calculateRefundAmount(advancePaid, current.checkInDate, rules)
    const paymentMethod = String(current.razorpayPaymentId || "").trim() ? "online" : "cash"

    await ref.set(
      {
        status: "cancelled",
        cancelledAt: Timestamp.now(),
        ...(cancellationReason ? { cancellationReason } : {}),
        paymentStatus: advancePaid > 0 ? "refund_requested" : String(current.paymentStatus || "pending"),
        refundStatus: advancePaid > 0 ? "refund_requested" : String(current.refundStatus || "none"),
        refundAmount: advancePaid > 0 ? refundAmount : Number(current.refundAmount || 0),
        paymentMethod: current.paymentMethod || paymentMethod,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    )

    await releaseBookingAvailability(id, Number(current.unitsBooked || 1))
    await markReservationsCancelled(id)

    await adminDb.collection("auditLogs").add({
      entity: "booking",
      entityId: id,
      action: "CANCEL",
      message: "User cancelled booking",
      payload: {
        previousStatus: status,
      },
      createdBy: decoded.uid,
      createdAt: Timestamp.now(),
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 })
  }
}

