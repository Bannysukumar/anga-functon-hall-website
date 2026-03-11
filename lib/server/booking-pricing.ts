import type { Listing, SiteSettings } from "@/lib/types"

export interface IntentAddonInput {
  name: string
  quantity: number
}

export interface BookingIntentInput {
  listingId: string
  branchId: string
  checkInDate: string
  checkOutDate?: string | null
  slotId: string | null
  slotName: string | null
  guestCount: number
  unitsBooked: number
  selectedRoomListingIds?: string[]
  selectedRoomNumbers?: string[]
  selectedAddons: IntentAddonInput[]
  couponCode?: string
  walletToUse?: number
}

export interface PricingBreakdown {
  basePrice: number
  addonsTotal: number
  serviceFee: number
  taxAmount: number
  couponDiscount: number
  totalAmount: number
  amountToPay: number
  dueAmount: number
  walletApplied?: number
  gatewayAmount?: number
  cashbackAmount?: number
}

function isSlotBasedListing(type: string) {
  return ["function_hall", "open_function_hall", "dining_hall", "local_tour"].includes(
    String(type || "")
  )
}

function getStayUnits(input: BookingIntentInput, listing: Listing) {
  if (isSlotBasedListing(listing.type)) return 1
  if (!input.checkOutDate) return 1
  const checkIn = new Date(`${input.checkInDate}T00:00:00`)
  const checkOut = new Date(`${input.checkOutDate}T00:00:00`)
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) return 1
  const diffDays = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (24 * 60 * 60 * 1000))
  return Math.max(1, diffDays)
}

export function calculatePricing(
  listing: Listing,
  settings: SiteSettings,
  input: BookingIntentInput,
  couponDiscount: number
): PricingBreakdown {
  const unitsBooked = Math.max(1, Number(input.unitsBooked || 1))
  const stayUnits = getStayUnits(input, listing)
  const basePrice = Math.max(
    0,
    Math.round((listing.pricePerUnit || 0) * unitsBooked * stayUnits)
  )

  const addonsTotal = input.selectedAddons.reduce((sum, addonInput) => {
    const qty = Math.max(1, Number(addonInput.quantity || 1))
    const addon = listing.addons.find((a) => a.name === addonInput.name)
    if (!addon) return sum
    // Keep addon billing deterministic and server-side.
    return sum + Math.round((addon.price || 0) * qty)
  }, 0)

  const subTotal = basePrice + addonsTotal
  const serviceFee = Math.round((subTotal * (settings.serviceFeePercent || 0)) / 100)
  const taxAmount = Math.round((subTotal * (settings.taxPercent || 0)) / 100)
  const preDiscountTotal = subTotal + serviceFee + taxAmount
  const normalizedDiscount = Math.min(Math.max(0, couponDiscount), preDiscountTotal)
  const totalAmount = Math.max(0, preDiscountTotal - normalizedDiscount)

  const amountToPay =
    listing.paymentMode === "full"
      ? totalAmount
      : listing.paymentMode === "advance_fixed"
        ? Math.min(listing.advanceAmount || 0, totalAmount)
        : Math.round(totalAmount * ((listing.advanceAmount || settings.minAdvancePercent || 0) / 100))

  const dueAmount = Math.max(0, totalAmount - amountToPay)

  return {
    basePrice,
    addonsTotal,
    serviceFee,
    taxAmount,
    couponDiscount: normalizedDiscount,
    totalAmount,
    amountToPay,
    dueAmount,
  }
}
