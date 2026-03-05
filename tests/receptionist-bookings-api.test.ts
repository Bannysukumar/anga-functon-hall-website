import { beforeEach, describe, expect, it, vi } from "vitest"

const permissionMock = vi.fn()
const toHttpErrorMock = vi.fn()
const sendBookingEmailMock = vi.fn()
const releaseBookingAvailabilityMock = vi.fn()
const markReservationsCancelledMock = vi.fn()

vi.mock("@/lib/server/permission-check", () => ({
  requirePermission: permissionMock,
  toHttpError: toHttpErrorMock,
}))

vi.mock("@/lib/server/booking-email", () => ({
  sendBookingEmail: sendBookingEmailMock,
}))

vi.mock("@/lib/server/booking-cancellation", () => ({
  releaseBookingAvailability: releaseBookingAvailabilityMock,
  markReservationsCancelled: markReservationsCancelledMock,
}))

const auditAddMock = vi.fn()
const bookingSetMock = vi.fn()
let currentBookingData: Record<string, unknown> = {
  status: "confirmed",
  totalAmount: 1000,
  advancePaid: 200,
}

const bookingRefMock = {
  get: vi.fn(async () => ({ exists: true, data: () => currentBookingData })),
  set: bookingSetMock,
}

vi.mock("@/lib/server/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn((name: string) => {
      if (name === "bookings") {
        return { doc: () => bookingRefMock }
      }
      if (name === "auditLogs") {
        return { add: auditAddMock }
      }
      return { doc: () => ({}) }
    }),
  },
}))

describe("receptionist bookings API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentBookingData = { status: "confirmed", totalAmount: 1000, advancePaid: 200 }
  })

  it("returns 403 when permission denied", async () => {
    permissionMock.mockRejectedValueOnce(new Error("FORBIDDEN"))
    toHttpErrorMock.mockReturnValueOnce({ status: 403, error: "Access denied" })
    const { POST } = await import("@/app/api/receptionist/bookings/route")
    const req = new Request("http://localhost/api/receptionist/bookings", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it("creates audit log on booking cancel", async () => {
    permissionMock.mockResolvedValueOnce({ uid: "staff_1" })
    const { PATCH } = await import("@/app/api/receptionist/bookings/[id]/route")
    const req = new Request("http://localhost/api/receptionist/bookings/abc", {
      method: "PATCH",
      body: JSON.stringify({ action: "cancel", cancellationReason: "by desk" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "abc" }) })
    expect(res.status).toBe(200)
    expect(bookingSetMock).toHaveBeenCalled()
    expect(auditAddMock).toHaveBeenCalled()
    expect(releaseBookingAvailabilityMock).toHaveBeenCalledWith("abc", 1)
    expect(markReservationsCancelledMock).toHaveBeenCalledWith("abc")
    expect(sendBookingEmailMock).toHaveBeenCalledWith("BOOKING_CANCELLED", "abc", expect.any(Object))
  })

  it("prevents checkout before check-in", async () => {
    permissionMock.mockResolvedValueOnce({ uid: "staff_1" })
    currentBookingData = { status: "confirmed", totalAmount: 1000, advancePaid: 200 }
    const { PATCH } = await import("@/app/api/receptionist/bookings/[id]/route")
    const req = new Request("http://localhost/api/receptionist/bookings/abc", {
      method: "PATCH",
      body: JSON.stringify({ action: "check_out" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "abc" }) })
    expect(res.status).toBe(409)
    expect(bookingSetMock).not.toHaveBeenCalled()
  })

  it("sends checkout email on successful checkout", async () => {
    permissionMock.mockResolvedValueOnce({ uid: "staff_1" })
    currentBookingData = {
      status: "checked_in",
      totalAmount: 1200,
      advancePaid: 1200,
      customerEmail: "guest@example.com",
    }
    const { PATCH } = await import("@/app/api/receptionist/bookings/[id]/route")
    const req = new Request("http://localhost/api/receptionist/bookings/abc", {
      method: "PATCH",
      body: JSON.stringify({ action: "check_out" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "abc" }) })
    expect(res.status).toBe(200)
    expect(sendBookingEmailMock).toHaveBeenCalledWith("BOOKING_CHECKOUT", "abc", expect.any(Object))
  })
})
