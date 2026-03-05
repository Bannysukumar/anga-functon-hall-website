import { NextResponse } from "next/server"
import { adminDb } from "@/lib/server/firebase-admin"
import { requirePermission, toHttpError } from "@/lib/server/permission-check"
import { receptionistCalendarQuerySchema } from "@/lib/server/receptionist-schemas"

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function isActiveBookingStatus(status: string) {
  return !["cancelled", "completed", "checked_out", "no_show"].includes(status)
}

export async function GET(request: Request) {
  try {
    await requirePermission(request, "view_calendar")
    const url = new URL(request.url)
    const parsed = receptionistCalendarQuerySchema.parse({
      view: url.searchParams.get("view") || "month",
      from: url.searchParams.get("from") || "",
      to: url.searchParams.get("to") || "",
      status: url.searchParams.get("status") || "all",
      eventType: url.searchParams.get("eventType") || "all",
    })

    const snap = await adminDb.collection("bookings").orderBy("createdAt", "desc").limit(1500).get()
    let items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    if (parsed.status !== "all") {
      items = items.filter((booking) => String(booking.status || "") === parsed.status)
    }
    if (parsed.eventType !== "all") {
      items = items.filter((booking) => String(booking.listingType || "") === parsed.eventType)
    }

    if (parsed.from || parsed.to) {
      const from = parsed.from ? new Date(`${parsed.from}T00:00:00`) : null
      const to = parsed.to ? new Date(`${parsed.to}T23:59:59`) : null
      items = items.filter((booking) => {
        const dt = booking.checkInDate?.toDate ? booking.checkInDate.toDate() : null
        if (!dt) return false
        if (from && dt < from) return false
        if (to && dt > to) return false
        return true
      })
    }

    const conflictMap = new Map<string, number>()
    items.forEach((booking) => {
      const status = String(booking.status || "")
      if (!isActiveBookingStatus(status)) return
      const dt = booking.checkInDate?.toDate ? booking.checkInDate.toDate() : null
      if (!dt) return
      const key = `${String(booking.listingId || "")}_${formatDateKey(dt)}`
      conflictMap.set(key, Number(conflictMap.get(key) || 0) + 1)
    })

    const events = items
      .map((booking) => {
        const dt = booking.checkInDate?.toDate ? booking.checkInDate.toDate() : null
        if (!dt) return null
        const key = `${String(booking.listingId || "")}_${formatDateKey(dt)}`
        const conflict = Number(conflictMap.get(key) || 0) > 1
        return {
          id: booking.id,
          bookingId: booking.id,
          customerName: String(booking.customerName || "Customer"),
          customerPhone: String(booking.customerPhone || ""),
          eventDate: dt.toISOString(),
          eventType: String(booking.listingType || "function_hall"),
          hallName: String(booking.listingTitle || "Hall"),
          hallId: String(booking.listingId || ""),
          status: String(booking.status || "pending"),
          paymentStatus: String(booking.paymentStatus || "pending"),
          totalAmount: Number(booking.totalAmount || 0),
          advancePaid: Number(booking.advancePaid || 0),
          remainingAmount: Math.max(
            0,
            Number(booking.remainingAmount || booking.dueAmount || Number(booking.totalAmount || 0) - Number(booking.advancePaid || 0))
          ),
          conflict,
        }
      })
      .filter(Boolean)

    return NextResponse.json({ items: events, view: parsed.view })
  } catch (error) {
    if ((error as { name?: string })?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid calendar query." }, { status: 422 })
    }
    const mapped = toHttpError(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}
