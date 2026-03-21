import { describe, expect, it } from "vitest"
import { intervalsOverlap, isRoomBookedForWindow, type PublicBookingWindow } from "@/lib/booking-public-availability"

describe("booking-public-availability", () => {
  it("intervalsOverlap detects overlap", () => {
    const aStart = new Date("2026-03-20T00:00:00.000Z")
    const aEnd = new Date("2026-03-22T00:00:00.000Z")
    const bStart = new Date("2026-03-21T10:00:00.000Z")
    const bEnd = new Date("2026-03-23T12:00:00.000Z")
    expect(intervalsOverlap(aStart, aEnd, bStart, bEnd)).toBe(true)
  })

  it("isRoomBookedForWindow matches room number and window", () => {
    const bookings: PublicBookingWindow[] = [
      {
        id: "b1",
        status: "confirmed",
        checkInMs: new Date("2026-03-20T14:00:00.000Z").getTime(),
        checkOutMs: new Date("2026-03-22T11:00:00.000Z").getTime(),
        roomNumbers: ["201"],
      },
    ]
    const winStart = new Date("2026-03-20T00:00:00.000Z")
    const winEnd = new Date("2026-03-21T00:00:00.000Z")
    const r = isRoomBookedForWindow("201", winStart, winEnd, bookings)
    expect(r.booked).toBe(true)
    expect(r.untilMs).toBeDefined()
  })

  it("isRoomBookedForWindow ignores other rooms", () => {
    const bookings: PublicBookingWindow[] = [
      {
        id: "b1",
        status: "confirmed",
        checkInMs: new Date("2026-03-20T14:00:00.000Z").getTime(),
        checkOutMs: new Date("2026-03-22T11:00:00.000Z").getTime(),
        roomNumbers: ["201"],
      },
    ]
    const winStart = new Date("2026-03-20T00:00:00.000Z")
    const winEnd = new Date("2026-03-21T00:00:00.000Z")
    const r = isRoomBookedForWindow("202", winStart, winEnd, bookings)
    expect(r.booked).toBe(false)
  })
})
