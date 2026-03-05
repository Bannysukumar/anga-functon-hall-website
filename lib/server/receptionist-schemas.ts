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

export const createBookingSchema = z.object({
  customerId: z.string().trim().max(120).optional(),
  listingId: z.string().trim().min(1).max(120),
  functionDateTime: z.string().trim().min(1).max(60),
  guestCount: z.coerce.number().int().min(1).max(100000),
  advanceAmount: z.coerce.number().min(0).max(10_000_000),
  totalAmount: z.coerce.number().min(1).max(10_000_000),
  paymentMethod: z.string().trim().min(2).max(40),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
})

export const updateBookingSchema = z.object({
  action: z.enum(["edit", "cancel", "check_in", "check_out"]).default("edit"),
  guestCount: z.coerce.number().int().min(1).max(100000).optional(),
  totalAmount: z.coerce.number().min(0).max(10_000_000).optional(),
  advancePaid: z.coerce.number().min(0).max(10_000_000).optional(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  cancellationReason: z.string().trim().max(500).optional().or(z.literal("")),
})
