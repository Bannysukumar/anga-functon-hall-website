import { beforeEach, describe, expect, it, vi } from "vitest"

const requirePermissionMock = vi.fn()
const toHttpErrorMock = vi.fn(() => ({ status: 500, error: "Unexpected server error" }))

const collections = new Map<string, unknown[]>()

function makeSnap(items: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    docs: items.map((item) => ({
      id: item.id,
      data: () => item.data,
    })),
  }
}

function makeQuery(name: string) {
  return {
    where: () => makeQuery(name),
    orderBy: () => makeQuery(name),
    limit: () => makeQuery(name),
    get: async () => makeSnap((collections.get(name) || []) as Array<{ id: string; data: Record<string, unknown> }>),
    doc: () => ({ set: vi.fn(), get: vi.fn(async () => ({ exists: false, data: () => ({}) })) }),
  }
}

vi.mock("@/lib/server/permission-check", () => ({
  requirePermission: requirePermissionMock,
  toHttpError: toHttpErrorMock,
}))

vi.mock("@/lib/server/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn((name: string) => makeQuery(name)),
  },
}))

describe("receptionist productivity APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    collections.clear()
    requirePermissionMock.mockResolvedValue({ uid: "desk_1" })
  })

  it("returns BOOKED in availability checker when a booking exists", async () => {
    collections.set("bookings", [
      {
        id: "bk1",
        data: {
          listingId: "hall-1",
          status: "confirmed",
          customerName: "Ramesh",
          listingType: "function_hall",
          checkInDate: { toDate: () => new Date("2026-05-12T11:00:00") },
        },
      },
    ])
    collections.set("listings", [{ id: "hall-1", data: { type: "function_hall", isActive: true } }])

    const { GET } = await import("@/app/api/receptionist/availability/route")
    const req = new Request("http://localhost/api/receptionist/availability?date=2026-05-12&hallType=all")
    const res = await GET(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.status).toBe("BOOKED")
    expect(json.booked.customerName).toBe("Ramesh")
  })

  it("returns visitor items from visitors API", async () => {
    collections.set("visitors", [
      {
        id: "v1",
        data: {
          name: "Suresh",
          phone: "9876543210",
          status: "new",
          eventType: "function_hall",
          preferredDate: "2026-05-20",
          notes: "",
        },
      },
    ])

    const { GET } = await import("@/app/api/receptionist/visitors/route")
    const req = new Request("http://localhost/api/receptionist/visitors?status=all&eventType=all")
    const res = await GET(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.items).toHaveLength(1)
    expect(json.items[0].name).toBe("Suresh")
  })

  it("validates visitor create date format", async () => {
    const { POST } = await import("@/app/api/receptionist/visitors/route")
    const req = new Request("http://localhost/api/receptionist/visitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Lead",
        phone: "9876543210",
        eventType: "function_hall",
        preferredDate: "bad-date",
        notes: "",
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
