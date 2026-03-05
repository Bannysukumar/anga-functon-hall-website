import { describe, expect, it } from "vitest"
import { canAccessByRole } from "@/lib/server/permission-check"

describe("canAccessByRole", () => {
  it("always allows admin", () => {
    expect(canAccessByRole("admin", [], "view_bookings")).toBe(true)
  })

  it("allows receptionist when permission exists", () => {
    expect(
      canAccessByRole("receptionist", ["view_bookings", "create_booking"], "create_booking")
    ).toBe(true)
  })

  it("allows legacy uppercase permission aliases", () => {
    expect(canAccessByRole("receptionist", ["BOOKINGS_VIEW"], "view_bookings")).toBe(true)
    expect(canAccessByRole("receptionist", ["USERS_VIEW"], "view_customers")).toBe(true)
    expect(canAccessByRole("receptionist", ["PAYMENTS_VIEW"], "view_payments")).toBe(true)
  })

  it("denies receptionist when permission missing", () => {
    expect(canAccessByRole("receptionist", ["view_bookings"], "create_booking")).toBe(false)
  })

  it("denies regular user", () => {
    expect(canAccessByRole("user", ["view_bookings"], "view_bookings")).toBe(false)
  })
})
