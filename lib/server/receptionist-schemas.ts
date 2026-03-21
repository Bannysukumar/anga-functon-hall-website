import { z } from "zod"

export const receptionistCustomersQuerySchema = z.object({
  search: z.string().trim().optional().default(""),
  limit: z.coerce.number().int().min(1).max(300).optional().default(20),
})

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(6).max(20),
  email: z.string().trim().email().max(200),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
})

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().min(6).max(20).optional(),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
})

export const createPaymentSchema = z.object({
  bookingId: z.string().trim().max(120).optional(),
  customerId: z.string().trim().max(120).optional(),
  amount: z.coerce.number().min(1).max(10_000_000),
  method: z.string().trim().min(2).max(40),
  note: z.string().trim().max(500).optional().or(z.literal("")),
})

export const receptionistBookingsQuerySchema = z.object({
  search: z.string().trim().optional().default(""),
  status: z.string().trim().optional().default("all"),
  from: z.string().trim().optional().default(""),
  to: z.string().trim().optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(300).optional().default(20),
})

/** Normalize JSON body so optional fields don't fail on null / "" (common from forms). */
function preprocessReceptionistCreateBooking(val: unknown) {
  if (!val || typeof val !== "object") return val
  const o = { ...(val as Record<string, unknown>) }
  const dropIfEmpty = (key: string) => {
    const v = o[key]
    if (v === null || v === undefined || v === "") delete o[key]
  }
  dropIfEmpty("customerId")
  dropIfEmpty("checkOutDateTime")
  dropIfEmpty("selectedRoomNumber")
  dropIfEmpty("roomType")
  dropIfEmpty("floor")
  dropIfEmpty("notes")
  if (o.notes === null) delete o.notes
  return o
}

export const createBookingSchema = z.preprocess(
  preprocessReceptionistCreateBooking,
  z.object({
    customerId: z.string().trim().max(120).optional(),
    listingId: z.string().trim().min(1).max(120),
    /** Check-in date/time (ISO or datetime-local compatible) */
    functionDateTime: z.string().trim().min(1).max(200),
    /** Check-out date/time; if omitted, defaults from listing/global checkout time on check-out day */
    checkOutDateTime: z.string().trim().max(200).optional(),
    /** Filter helpers (room listings): AC / Non-AC */
    roomType: z.enum(["ac", "non_ac"]).optional(),
    /** Floor number (1 = 1st floor, etc.) */
    floor: z.coerce.number().int().min(0).max(100).optional(),
    selectedRoomNumbers: z.array(z.string().trim().min(1).max(60)).optional(),
    /** Single room selection (preferred for room listings) */
    selectedRoomNumber: z.string().trim().min(1).max(60).optional(),
    guestCount: z.preprocess(
      (v) => {
        if (v === "" || v === null || v === undefined) return 1
        const n = Number(v)
        return Number.isFinite(n) && n < 1 ? 1 : v
      },
      z.coerce.number().int().min(1).max(100000)
    ),
    advanceAmount: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? 0 : v),
      z.coerce.number().min(0).max(10_000_000)
    ),
    totalAmount: z.coerce.number().min(1).max(10_000_000),
    paymentMethod: z.string().trim().min(2).max(40),
    notes: z.string().trim().max(500).optional(),
  })
)

export const updateBookingSchema = z.object({
  action: z.enum(["edit", "cancel", "check_in", "check_out"]).default("edit"),
  guestCount: z.coerce.number().int().min(1).max(100000).optional(),
  totalAmount: z.coerce.number().min(0).max(10_000_000).optional(),
  advancePaid: z.coerce.number().min(0).max(10_000_000).optional(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  cancellationReason: z.string().trim().max(500).optional().or(z.literal("")),
})

export const receptionistCalendarQuerySchema = z.object({
  view: z.enum(["month", "week", "day"]).optional().default("month"),
  from: z.string().trim().optional().default(""),
  to: z.string().trim().optional().default(""),
  status: z.string().trim().optional().default("all"),
  eventType: z.string().trim().optional().default("all"),
})

export const receptionistAvailabilityQuerySchema = z.object({
  date: z.string().trim().min(10).max(25),
  hallType: z.string().trim().optional().default("all"),
})

export const visitorLeadStatusSchema = z.enum([
  "new",
  "follow_up",
  "interested",
  "converted",
  "not_interested",
])

export const visitorsQuerySchema = z.object({
  status: visitorLeadStatusSchema.or(z.literal("all")).optional().default("all"),
  eventType: z.string().trim().optional().default("all"),
  from: z.string().trim().optional().default(""),
  to: z.string().trim().optional().default(""),
  search: z.string().trim().optional().default(""),
  limit: z.coerce.number().int().min(1).max(300).optional().default(100),
})

export const createVisitorSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(6).max(20),
  eventType: z.string().trim().min(1).max(60),
  preferredDate: z.string().trim().min(8).max(25),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  visitDate: z.string().trim().optional().default(""),
})

export const updateVisitorSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().min(6).max(20).optional(),
  eventType: z.string().trim().min(1).max(60).optional(),
  preferredDate: z.string().trim().min(8).max(25).optional(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  status: visitorLeadStatusSchema.optional(),
})

export const convertVisitorSchema = z.object({
  listingId: z.string().trim().min(1).max(120),
  functionDateTime: z.string().trim().min(1).max(60),
  guestCount: z.coerce.number().int().min(1).max(100000).default(1),
  totalAmount: z.coerce.number().min(1).max(10_000_000),
  advanceAmount: z.coerce.number().min(0).max(10_000_000).default(0),
  paymentMethod: z.string().trim().min(2).max(40).default("cash"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
})
