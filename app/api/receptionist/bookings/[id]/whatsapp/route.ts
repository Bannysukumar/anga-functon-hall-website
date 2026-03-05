import { NextResponse } from "next/server"
import { Timestamp } from "firebase-admin/firestore"
import { adminDb } from "@/lib/server/firebase-admin"
import { requirePermission, toHttpError } from "@/lib/server/permission-check"
import {
  buildBookingConfirmationMessage,
  buildPaymentReminderMessage,
  sendWhatsAppMessage,
} from "@/lib/server/whatsapp"

function formatDateForMessage(date: Date | null) {
  if (!date) return "-"
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { uid } = await requirePermission(request, "send_whatsapp")
    const body = (await request.json().catch(() => ({}))) as { kind?: "confirmation" | "reminder" }
    const kind = body.kind === "reminder" ? "reminder" : "confirmation"

    const bookingRef = adminDb.collection("bookings").doc(id)
    const bookingSnap = await bookingRef.get()
    if (!bookingSnap.exists) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 })
    }
    const booking = bookingSnap.data() || {}
    const phone = String(booking.customerPhone || "")
    const customerName = String(booking.customerName || "Customer")
    const eventDate = booking.checkInDate?.toDate ? formatDateForMessage(booking.checkInDate.toDate()) : "-"
    const remaining = Math.max(
      0,
      Number(booking.remainingAmount || booking.dueAmount || Number(booking.totalAmount || 0) - Number(booking.advancePaid || 0))
    )
    const message =
      kind === "confirmation"
        ? buildBookingConfirmationMessage({
            customerName,
            eventDate,
            hallName: String(booking.listingTitle || "Anga Function Hall"),
          })
        : buildPaymentReminderMessage({
            customerName,
            eventDate,
            remainingAmount: remaining,
          })

    const result = await sendWhatsAppMessage(phone, message)
    await bookingRef.set(
      {
        whatsappStatus: result.status,
        whatsappSentAt: result.status === "sent" ? Timestamp.now() : null,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    )
    await adminDb.collection("auditLogs").add({
      entity: "booking",
      entityId: id,
      action: kind === "confirmation" ? "WHATSAPP_CONFIRMATION" : "WHATSAPP_REMINDER",
      message: result.status === "sent" ? "WhatsApp message sent" : "WhatsApp message failed/disabled",
      payload: { phone, status: result.status, error: result.error || null },
      createdBy: uid,
      createdAt: Timestamp.now(),
    })

    if (result.status === "failed") {
      return NextResponse.json({ error: result.error || "Failed to send WhatsApp." }, { status: 502 })
    }
    return NextResponse.json({ ok: true, status: result.status })
  } catch (error) {
    const mapped = toHttpError(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}
