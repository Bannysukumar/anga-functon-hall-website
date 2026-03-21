/**
 * Client-safe helpers: time-based room availability from minimal booking snapshots
 * (used by /explore/[listingId] with data from /api/public/listing-availability).
 */

export const BLOCKING_BOOKING_STATUSES = new Set(["pending", "confirmed", "checked_in"])

export type PublicBookingWindow = {
  id: string
  status: string
  checkInMs: number
  checkOutMs: number
  /** Room numbers this booking occupies (from selectedRoomNumbers + roomNumber). */
  roomNumbers: string[]
}

/** Standard interval overlap: [aStart, aEnd) vs [bStart, bEnd) using Date ms. */
export function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime()
}

/**
 * Whether the given physical room is booked for the guest's selected window.
 * Only bookings with explicit room numbers are considered (receptionist flow always sets these).
 */
export function isRoomBookedForWindow(
  roomNumber: string,
  windowStart: Date,
  windowEnd: Date,
  bookings: PublicBookingWindow[]
): { booked: boolean; untilMs?: number } {
  const r = String(roomNumber).trim()
  let bestUntil: number | undefined
  for (const b of bookings) {
    if (!BLOCKING_BOOKING_STATUSES.has(b.status)) continue
    if (!b.roomNumbers.length || !b.roomNumbers.includes(r)) continue
    const bStart = new Date(b.checkInMs)
    const bEnd = new Date(b.checkOutMs)
    if (!intervalsOverlap(windowStart, windowEnd, bStart, bEnd)) continue
    bestUntil = bestUntil === undefined ? b.checkOutMs : Math.max(bestUntil, b.checkOutMs)
  }
  if (bestUntil !== undefined) return { booked: true, untilMs: bestUntil }
  return { booked: false }
}
