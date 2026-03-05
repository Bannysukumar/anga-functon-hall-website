import { NextResponse } from "next/server"
import { Timestamp } from "firebase-admin/firestore"
import { adminAuth, adminDb } from "@/lib/server/firebase-admin"
import { sendBookingEmail } from "@/lib/server/booking-email"

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
    const uid = decoded.uid
    const { id } = await params
    const ref = adminDb.collection("bookings").doc(id)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 })
    }
    const current = snap.data() || {}
    if (String(current.userId || "") !== uid) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 })
    }
    const status = String(current.status || "")
    if (!["confirmed", "checked_in"].includes(status)) {
      return NextResponse.json(
        { error: "Booking cannot be checked out in its current state." },
        { status: 409 }
      )
    }

    const now = Date.now()
    const scheduledCheckInAt = (current.scheduledCheckInAt as { toDate?: () => Date } | undefined)?.toDate?.()?.getTime?.()
    if (scheduledCheckInAt != null && scheduledCheckInAt > 0 && now < scheduledCheckInAt) {
      return NextResponse.json(
        { error: "Checkout is not allowed before the check-in window." },
        { status: 409 }
      )
    }

    const updates = {
      status: "checked_out",
      checkOutAt: Timestamp.now(),
      checkedOutBy: uid,
      checkoutMethod: "USER",
      checkoutNotes: "",
      updatedAt: Timestamp.now(),
    }
    await ref.set(updates, { merge: true })

    const payload = { ...current, ...updates }
    try {
      await sendBookingEmail("BOOKING_CHECKOUT", id, payload)
    } catch (emailError) {
      console.error("Checkout email failed", { bookingId: id, error: emailError })
    }

    await adminDb.collection("auditLogs").add({
      entity: "booking",
      entityId: id,
      action: "CHECKOUT",
      message: "User checked out",
      payload: { method: "USER" },
      createdBy: uid,
      createdAt: Timestamp.now(),
    })

    return NextResponse.json({ ok: true, status: "checked_out" })
  } catch (err) {
    console.error("Checkout error", err)
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 })
  }
}
