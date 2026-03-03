import type { Listing, SiteSettings } from "@/lib/types"

export interface IntentAddonInput {
  name: string
  quantity: number
}

export interface BookingIntentInput {
  listingId: string
  branchId: string
  checkInDate: string
  slotId: string | null
  slotName: string | null
  guestCount: number
  unitsBooked: number
  selectedAddons: IntentAddonInput[]
  couponCode?: string
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
}

export function calculatePricing(
  listing: Listing,
  settings: SiteSettings,
  input: BookingIntentInput,
  couponDiscount: number
): PricingBreakdown {
  const unitsBooked = Math.max(1, Number(input.unitsBooked || 1))
  const basePrice = Math.max(0, Math.round((listing.pricePerUnit || 0) * unitsBooked))

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
