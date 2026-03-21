import type { Timestamp } from "firebase-admin/firestore"

export type RoomConfigEntry = {
  roomNumber: string
  roomType: "ac" | "non_ac"
  floorNumber?: number
  price?: number
}

function toJsDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const ts = value as Timestamp
  if (typeof ts?.toDate === "function") {
    const d = ts.toDate()
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

/** Active booking statuses that block a room for overlapping stays */
export function bookingStatusBlocksRoom(status: string): boolean {
  return !["cancelled", "completed", "checked_out", "no_show", "expired"].includes(
    String(status || "")
  )
}

export function getBookingTimeWindow(booking: Record<string, unknown>): {
  start: Date
  end: Date
} | null {
  const checkIn = toJsDate(booking.checkInDate) || toJsDate(booking.scheduledCheckInAt)
  if (!checkIn) return null
  const checkOut =
    toJsDate(booking.checkOutDate) ||
    toJsDate(booking.scheduledCheckOutAt) ||
    new Date(checkIn.getTime() + 24 * 60 * 60 * 1000)
  return { start: checkIn, end: checkOut }
}

export function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime()
}

export function roomIntervalsOverlap(
  newStart: Date,
  newEnd: Date,
  existingBookings: Array<Record<string, unknown>>,
  roomNumber: string,
  listingId: string
): boolean {
  const normalized = String(roomNumber || "").trim()
  if (!normalized) return false
  for (const b of existingBookings) {
    if (String(b.listingId || "") !== listingId) continue
    if (!bookingStatusBlocksRoom(String(b.status || ""))) continue
    const rooms = Array.isArray(b.selectedRoomNumbers)
      ? (b.selectedRoomNumbers as unknown[]).map((x) => String(x).trim())
      : []
    const legacy = String(b.roomNumber || "").trim()
    const matchesRoom =
      rooms.includes(normalized) || (legacy === normalized && rooms.length === 0)
    if (!matchesRoom) continue
    const win = getBookingTimeWindow(b)
    if (!win) continue
    if (intervalsOverlap(newStart, newEnd, win.start, win.end)) return true
  }
  return false
}

export function parseRoomConfigurations(
  listing: Record<string, unknown>
): RoomConfigEntry[] {
  const raw = listing.roomConfigurations
  if (!Array.isArray(raw)) return []
  const out: RoomConfigEntry[] = []
  for (const item of raw) {
    const row = item as Record<string, unknown>
    const num = String(row.roomNumber || "").trim()
    if (!num) continue
    const rt = String(row.roomType || "ac").toLowerCase() === "non_ac" ? "non_ac" : "ac"
    const floor = Number(row.floorNumber)
    out.push({
      roomNumber: num,
      roomType: rt,
      floorNumber: Number.isFinite(floor) ? floor : undefined,
      price: Number(row.price),
    })
  }
  return out
}

export function filterRoomsByTypeAndFloor(
  rooms: RoomConfigEntry[],
  roomType: "ac" | "non_ac" | null,
  floor: number | null
): RoomConfigEntry[] {
  let list = rooms
  if (roomType) {
    list = list.filter((r) => r.roomType === roomType)
  }
  if (floor != null && Number.isFinite(floor)) {
    list = list.filter((r) => r.floorNumber === floor)
  }
  return list
}
