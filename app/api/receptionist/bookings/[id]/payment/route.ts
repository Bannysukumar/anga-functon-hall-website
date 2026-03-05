import { NextResponse } from "next/server"
import { Timestamp } from "firebase-admin/firestore"
import { adminDb } from "@/lib/server/firebase-admin"
import { requirePermission, toHttpError } from "@/lib/server/permission-check"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { uid } = await requirePermission(request, "manage_payment_reminders")
    const { id } = await params
    const ref = adminDb.collection("bookings").doc(id)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 })
    }
    const booking = snap.data() || {}
    const totalAmount = Math.max(0, Number(booking.totalAmount || 0))
    await ref.set(
      {
        advancePaid: totalAmount,
        dueAmount: 0,
        remainingAmount: 0,
        paymentStatus: "paid",
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    )
    await adminDb.collection("auditLogs").add({
      entity: "booking",
      entityId: id,
      action: "MARK_PAID",
      message: "Marked booking as paid",
      payload: { totalAmount },
      createdBy: uid,
      createdAt: Timestamp.now(),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const mapped = toHttpError(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}
