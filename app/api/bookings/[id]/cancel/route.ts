import { NextResponse } from "next/server"
import { Timestamp } from "firebase-admin/firestore"
import { adminAuth, adminDb } from "@/lib/server/firebase-admin"
import { markReservationsCancelled, releaseBookingAvailability } from "@/lib/server/booking-cancellation"

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

    await ref.set(
      {
        status: "cancelled",
        cancelledAt: Timestamp.now(),
        paymentStatus:
          Number(current.advancePaid || 0) > 0 ? "refund_requested" : String(current.paymentStatus || "pending"),
        refundStatus: Number(current.advancePaid || 0) > 0 ? "requested" : String(current.refundStatus || "none"),
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

