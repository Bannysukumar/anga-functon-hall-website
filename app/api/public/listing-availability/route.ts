import { NextResponse } from "next/server"
import type { Timestamp } from "firebase-admin/firestore"
import { adminDb } from "@/lib/server/firebase-admin"
import { BLOCKING_BOOKING_STATUSES, type PublicBookingWindow } from "@/lib/booking-public-availability"

export const dynamic = "force-dynamic"

function toMs(ts: unknown): number | null {
  if (!ts || typeof ts !== "object") return null
  const t = ts as Timestamp
  if (typeof t.toMillis === "function") return t.toMillis()
  return null
}

/**
 * Public, non-PII snapshot of active bookings for a listing (Admin SDK).
 * Used by /explore/[listingId] for time-based room availability (Firestore rules block client reads).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const listingId = searchParams.get("listingId")?.trim()
  if (!listingId) {
    return NextResponse.json({ error: "listingId is required" }, { status: 400 })
  }

  try {
    const snap = await adminDb.collection("bookings").where("listingId", "==", listingId).limit(500).get()

    const bookings: PublicBookingWindow[] = snap.docs
      .map((doc) => {
        const data = doc.data()
        const nums = new Set<string>()
        if (Array.isArray(data.selectedRoomNumbers)) {
          for (const x of data.selectedRoomNumbers) {
            const s = String(x ?? "").trim()
            if (s) nums.add(s)
          }
        }
        const rn = String(data.roomNumber ?? "").trim()
        if (rn) nums.add(rn)

        const checkInMs = toMs(data.checkInDate)
        const checkOutMs = toMs(data.checkOutDate)
        const status = String(data.status || "")

        return {
          id: doc.id,
          status,
          checkInMs: checkInMs ?? 0,
          checkOutMs: checkOutMs ?? 0,
          roomNumbers: [...nums],
        } satisfies PublicBookingWindow
      })
      .filter(
        (b) =>
          b.checkInMs > 0 &&
          b.checkOutMs > 0 &&
          BLOCKING_BOOKING_STATUSES.has(b.status) &&
          b.roomNumbers.length > 0
      )

    return NextResponse.json(
      { bookings },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  } catch (e) {
    console.error("[listing-availability]", e)
    return NextResponse.json({ error: "Failed to load availability" }, { status: 500 })
  }
}
