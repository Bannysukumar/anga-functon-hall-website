import { NextResponse } from "next/server"
import { Timestamp } from "firebase-admin/firestore"
import { adminDb } from "@/lib/server/firebase-admin"
import { requirePermission, toHttpError } from "@/lib/server/permission-check"
import { sendRefundEmail } from "@/lib/server/refund-email"

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
    const rs = String(data.refundStatus || "").toLowerCase()
    if (rs === "refunded" || rs === "rejected" || rs === "processed") {
      return NextResponse.json({ error: "Refund already completed or rejected." }, { status: 409 })
    }
    if (rs === "approved") {
      return NextResponse.json({ ok: true, refundStatus: "approved" })
    }
    if (rs !== "refund_requested" && rs !== "requested" && rs !== "none" && rs !== "") {
      return NextResponse.json({ error: "Refund is not in requested state." }, { status: 409 })
    }
    await ref.set(
      {
        refundStatus: "approved",
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    )
    await adminDb.collection("auditLogs").add({
      entity: "booking",
      entityId: bookingId,
      action: "REFUND_APPROVED",
      message: "Refund approved by admin",
      createdBy: uid,
      createdAt: Timestamp.now(),
    })
    const payload = { ...data, refundStatus: "approved" }
    try {
      await sendRefundEmail("REFUND_APPROVED", bookingId, payload)
    } catch (e) {
      console.error("Refund approved email failed", e)
    }
    return NextResponse.json({ ok: true, refundStatus: "approved" })
  } catch (error) {
    if ((error as { message?: string }).message === "FORBIDDEN" || (error as { message?: string }).message === "UNAUTHORIZED") {
      const mapped = toHttpError(error)
      return NextResponse.json({ error: mapped.error }, { status: mapped.status })
    }
    console.error("Refund approve error", error)
    return NextResponse.json({ error: "Failed to approve refund" }, { status: 500 })
  }
}
