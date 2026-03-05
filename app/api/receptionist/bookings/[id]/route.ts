import { NextResponse } from "next/server"
import { Timestamp } from "firebase-admin/firestore"
import { adminDb } from "@/lib/server/firebase-admin"
import { requirePermission, toHttpError } from "@/lib/server/permission-check"
import { updateBookingSchema } from "@/lib/server/receptionist-schemas"
import { getRequestMeta, sanitizeText } from "@/lib/server/request-meta"
import { sendBookingEmail } from "@/lib/server/booking-email"
import { markReservationsCancelled, releaseBookingAvailability } from "@/lib/server/booking-cancellation"

function actionToPermission(action: string) {
  if (action === "cancel") return "cancel_booking" as const
  if (action === "check_in") return "check_in" as const
  if (action === "check_out") return "check_out" as const
  return "edit_booking" as const
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const meta = getRequestMeta(request)
    const body = updateBookingSchema.parse(await request.json())
    const action = String(body.action || "edit")
    const permission = actionToPermission(action)
    const { uid } = await requirePermission(request, permission)

    const ref = adminDb.collection("bookings").doc(id)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 })
    }
    const current = snap.data() || {}
    const currentStatus = String(current.status || "")
    const updates: Record<string, unknown> = { updatedAt: Timestamp.now() }

    if (action === "cancel") {
      if (["cancelled", "checked_out"].includes(currentStatus)) {
        return NextResponse.json(
          { error: "Cannot cancel a cancelled or checked-out booking." },
          { status: 409 }
        )
      }
      updates.status = "cancelled"
      updates.cancellationReason = sanitizeText(body.cancellationReason || "", 500)
      updates.cancelledAt = Timestamp.now()
      updates.paymentStatus =
        Number(current.advancePaid || 0) > 0 ? "refund_requested" : String(current.paymentStatus || "pending")
      updates.refundStatus = Number(current.advancePaid || 0) > 0 ? "requested" : String(current.refundStatus || "none")
    } else if (action === "check_in") {
      if (currentStatus !== "confirmed") {
        return NextResponse.json(
          { error: "Only confirmed bookings can be checked in." },
          { status: 409 }
        )
      }
      updates.status = "checked_in"
      updates.checkInAt = Timestamp.now()
      updates.checkedInBy = uid
    } else if (action === "check_out") {
      if (currentStatus !== "checked_in") {
        return NextResponse.json(
          { error: "Only checked-in bookings can be checked out." },
          { status: 409 }
        )
      }
      updates.status = "checked_out"
      updates.checkOutAt = Timestamp.now()
      updates.checkedOutBy = uid
      updates.checkoutMethod = "ADMIN"
      updates.checkoutNotes = sanitizeText(body.notes || "", 500)
    } else {
      const nextTotal =
        body.totalAmount !== undefined
          ? Math.max(0, Number(body.totalAmount || 0))
          : Number(current.totalAmount || 0)
      const nextAdvance =
        body.advancePaid !== undefined
          ? Math.max(0, Number(body.advancePaid || 0))
          : Number(current.advancePaid || 0)
      if (body.guestCount !== undefined) {
        updates.guestCount = Math.max(1, Number(body.guestCount || 1))
      }
      if (body.notes !== undefined) {
        updates.bookingNotes = sanitizeText(body.notes || "", 500)
      }
      updates.totalAmount = nextTotal
      updates.advancePaid = nextAdvance
      updates.dueAmount = Math.max(0, nextTotal - nextAdvance)
      updates.remainingAmount = Math.max(0, nextTotal - nextAdvance)
      updates.paymentStatus =
        Math.max(0, nextTotal - nextAdvance) > 0 ? "partial" : "paid"
    }

    await ref.set(updates, { merge: true })
    if (action === "cancel") {
      await releaseBookingAvailability(id, Number(current.unitsBooked || 1))
      await markReservationsCancelled(id)
    }
    const emailPayload = { ...current, ...updates }
    try {
      if (action === "cancel") {
        await sendBookingEmail("BOOKING_CANCELLED", id, emailPayload)
      } else if (action === "check_out") {
        await sendBookingEmail("BOOKING_CHECKOUT", id, emailPayload)
      } else if (action === "edit") {
        await sendBookingEmail("BOOKING_UPDATED", id, emailPayload)
      }
    } catch (error) {
      console.error("Booking email dispatch failed", {
        bookingId: id,
        action,
        error: error instanceof Error ? error.message : String(error),
      })
    }
    await adminDb.collection("auditLogs").add({
      entity: "booking",
      entityId: id,
      action: action.toUpperCase(),
      message: `Receptionist booking action: ${action}`,
      payload: { ...updates, ip: meta.ip, userAgent: meta.userAgent },
      createdBy: uid,
      createdAt: Timestamp.now(),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if ((error as { name?: string })?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid booking update payload." }, { status: 422 })
    }
    const mapped = toHttpError(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}
