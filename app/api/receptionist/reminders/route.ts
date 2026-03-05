import { NextResponse } from "next/server"
import { adminDb } from "@/lib/server/firebase-admin"
import { requirePermission, toHttpError } from "@/lib/server/permission-check"
import { bookingDateKeyFromDate } from "@/lib/server/booking-time"

function activeStatus(status: string) {
  return ["pending", "confirmed", "checked_in"].includes(status)
}

function daysDiff(start: Date, end: Date) {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime()
  return Math.round((e - s) / (24 * 60 * 60 * 1000))
}

export async function GET(request: Request) {
  try {
    await requirePermission(request, "manage_payment_reminders")
    const settingsSnap = await adminDb.collection("settings").doc("global").get()
    const enabled = settingsSnap.exists ? settingsSnap.data()?.paymentRemindersEnabled !== false : true
    if (!enabled) return NextResponse.json({ enabled: false, items: [] })

    const snap = await adminDb.collection("bookings").orderBy("createdAt", "desc").limit(1500).get()
    const today = new Date()
    const items = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .map((booking) => {
        const eventDate = booking.checkInDate?.toDate ? booking.checkInDate.toDate() : null
        const remaining = Math.max(
          0,
          Number(booking.remainingAmount || booking.dueAmount || Number(booking.totalAmount || 0) - Number(booking.advancePaid || 0))
        )
        const diff = eventDate ? daysDiff(today, eventDate) : null
        return {
          id: booking.id,
          bookingId: booking.id,
          customerName: String(booking.customerName || "Customer"),
          customerPhone: String(booking.customerPhone || ""),
          eventDate: eventDate ? bookingDateKeyFromDate(eventDate) : "",
          remainingAmount: remaining,
          paymentStatus: String(booking.paymentStatus || "pending"),
          daysBeforeEvent: diff,
          listingTitle: String(booking.listingTitle || "Hall"),
          status: String(booking.status || "pending"),
        }
      })
      .filter((item) => item.daysBeforeEvent !== null)
      .filter((item) => [7, 3, 1].includes(Number(item.daysBeforeEvent)))
      .filter((item) => item.remainingAmount > 0)
      .filter((item) => activeStatus(item.status))
      .sort((a, b) => Number(a.daysBeforeEvent) - Number(b.daysBeforeEvent))

    return NextResponse.json({ enabled: true, items })
  } catch (error) {
    const mapped = toHttpError(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}
