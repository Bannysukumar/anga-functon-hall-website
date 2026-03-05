import { NextResponse } from "next/server"
import { adminDb } from "@/lib/server/firebase-admin"
import { requirePermission, toHttpError } from "@/lib/server/permission-check"
import { receptionistAvailabilityQuerySchema } from "@/lib/server/receptionist-schemas"
import { bookingDateKeyFromDate, bookingDateKeyFromInput } from "@/lib/server/booking-time"

function activeStatus(status: string) {
  return !["cancelled", "completed", "checked_out", "no_show"].includes(status)
}

export async function GET(request: Request) {
  try {
    await requirePermission(request, "view_bookings")
    const url = new URL(request.url)
    const parsed = receptionistAvailabilityQuerySchema.parse({
      date: url.searchParams.get("date") || "",
      hallType: url.searchParams.get("hallType") || "all",
    })
    const dateKey = bookingDateKeyFromInput(parsed.date)
    if (!dateKey) {
      return NextResponse.json({ error: "Invalid date." }, { status: 400 })
    }

    const [bookingsSnap, listingsSnap] = await Promise.all([
      adminDb.collection("bookings").orderBy("createdAt", "desc").limit(1500).get(),
      adminDb.collection("listings").where("isActive", "==", true).limit(500).get(),
    ])

    const listings = listingsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    const filteredListingIds =
      parsed.hallType === "all"
        ? listings.map((item) => String(item.id))
        : listings
            .filter((item) => String(item.type || "") === parsed.hallType)
            .map((item) => String(item.id))

    const sameDayBookings = bookingsSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((booking) => {
        const dt = booking.checkInDate?.toDate ? booking.checkInDate.toDate() : null
        if (!dt) return false
        if (bookingDateKeyFromDate(dt) !== dateKey) return false
        if (!filteredListingIds.includes(String(booking.listingId || ""))) return false
        return activeStatus(String(booking.status || ""))
      })

    const first = sameDayBookings[0]
    const status = first ? "BOOKED" : "AVAILABLE"

    const busyDateSet = new Set(
      bookingsSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((booking) => {
          if (!filteredListingIds.includes(String(booking.listingId || ""))) return false
          return activeStatus(String(booking.status || ""))
        })
        .map((booking) => {
          const dt = booking.checkInDate?.toDate ? booking.checkInDate.toDate() : null
          return dt ? bookingDateKeyFromDate(dt) : ""
        })
        .filter(Boolean)
    )

    const nextAvailableDates: string[] = []
    const start = new Date(`${dateKey}T00:00:00`)
    for (let offset = 1; offset <= 45 && nextAvailableDates.length < 3; offset += 1) {
      const cursor = new Date(start)
      cursor.setDate(start.getDate() + offset)
      const key = bookingDateKeyFromDate(cursor)
      if (!busyDateSet.has(key)) {
        nextAvailableDates.push(key)
      }
    }

    return NextResponse.json({
      date: dateKey,
      status,
      booked: first
        ? {
            customerName: String(first.customerName || "Customer"),
            eventType: String(first.listingType || "function_hall"),
            bookingStatus: String(first.status || "pending"),
            bookingId: first.id,
          }
        : null,
      nextAvailableDates,
    })
  } catch (error) {
    if ((error as { name?: string })?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid availability query." }, { status: 422 })
    }
    const mapped = toHttpError(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}
