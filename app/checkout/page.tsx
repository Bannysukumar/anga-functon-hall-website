"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/hooks/use-auth"
import {
  getListing,
  getBranch,
  getCouponByCode,
  getSettings,
} from "@/lib/firebase-db"
import type { Listing, Branch, SiteSettings, SelectedAddon } from "@/lib/types"
import { DEFAULT_SETTINGS, LISTING_TYPE_LABELS } from "@/lib/constants"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { verifyPaymentAndConfirmBooking } from "@/lib/booking-functions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { CalendarDays, MapPin, Users, Clock, Tag, CreditCard } from "lucide-react"
import { toast } from "sonner"

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void }
  }
}

interface CheckoutData {
  listingId: string
  branchId: string
  checkInDate: string
  slotId: string | null
  slotName: string | null
  guestCount: number
  unitsBooked: number
  selectedAddons: SelectedAddon[]
  basePrice: number
  addonsTotal: number
  serviceFee: number
  taxAmount: number
  totalAmount: number
}

interface ServerIntentPricing {
  totalAmount: number
  amountToPay: number
  dueAmount: number
}

interface ServerBookingIntent {
  intentId: string
  keyId: string
  orderId: string
  amount: number
  currency: string
  displayName: string
  pricing: ServerIntentPricing
}

export default function CheckoutPage() {
  const router = useRouter()
  const { user, appUser } = useAuth()

  const [checkout, setCheckout] = useState<CheckoutData | null>(null)
  const [listing, setListing] = useState<Listing | null>(null)
  const [branch, setBranch] = useState<Branch | null>(null)
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const [couponCode, setCouponCode] = useState("")
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponId, setCouponId] = useState<string | null>(null)
  const [applyingCoupon, setApplyingCoupon] = useState(false)

  useEffect(() => {
    async function load() {
      const stored = sessionStorage.getItem("checkoutData")
      if (!stored) {
        toast.error("No booking data found. Please start again.")
        router.push("/explore")
        return
      }

      const data: CheckoutData = JSON.parse(stored)
      setCheckout(data)

      try {
        const [listingData, settingsData] = await Promise.all([
          getListing(data.listingId),
          getSettings(),
        ])
        setListing(listingData)
        setSettings(settingsData)

        if (data.branchId) {
          const branchData = await getBranch(data.branchId)
          setBranch(branchData)
        }
      } catch {
        toast.error("Failed to load details")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return
    setApplyingCoupon(true)
    try {
      const coupon = await getCouponByCode(couponCode)
      if (!coupon) {
        toast.error("Invalid or expired coupon code")
        return
      }

      const now = new Date()
      if (coupon.validFrom?.toDate && now < coupon.validFrom.toDate()) {
        toast.error("This coupon is not yet active")
        return
      }
      if (coupon.validUntil?.toDate && now > coupon.validUntil.toDate()) {
        toast.error("This coupon has expired")
        return
      }
      if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
        toast.error("This coupon has reached its usage limit")
        return
      }

      const total = checkout?.totalAmount || 0
      if (coupon.minOrderAmount > 0 && total < coupon.minOrderAmount) {
        toast.error(
          `Minimum order amount is \u20B9${coupon.minOrderAmount.toLocaleString("en-IN")}`
        )
        return
      }

      let discount = 0
      if (coupon.discountType === "flat") {
        discount = coupon.discountValue
      } else {
        discount = Math.round(total * (coupon.discountValue / 100))
      }

      setCouponDiscount(discount)
      setCouponId(coupon.id)
      toast.success(`Coupon applied! You save \u20B9${discount.toLocaleString("en-IN")}`)
    } catch {
      toast.error("Failed to apply coupon")
    } finally {
      setApplyingCoupon(false)
    }
  }

  function loadRazorpayScript(): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window !== "undefined" && window.Razorpay) {
        resolve(true)
        return
      }
      const script = document.createElement("script")
      script.src = "https://checkout.razorpay.com/v1/checkout.js"
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  async function handlePayment() {
    if (!user || !checkout || !listing) return
    if (appUser?.isBlocked) {
      toast.error("Your account is blocked. Please contact support.")
      return
    }

    const branchIdForIntent = checkout.branchId || listing.branchId || ""
    if (!checkout.listingId || !checkout.checkInDate) {
      toast.error("Booking details are incomplete. Please select listing/date again.")
      return
    }

    setProcessing(true)
    try {
      const scriptLoaded = await loadRazorpayScript()
      if (!scriptLoaded) {
        toast.error("Failed to load payment gateway. Please try again.")
        setProcessing(false)
        return
      }

      const finalTotal = checkout.totalAmount - couponDiscount
      const intentResponse = await fetch("/api/bookings/create-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({
          listingId: checkout.listingId,
          branchId: branchIdForIntent,
          checkInDate: checkout.checkInDate,
          slotId: checkout.slotId,
          slotName: checkout.slotName,
          guestCount: checkout.guestCount,
          unitsBooked: checkout.unitsBooked,
          selectedAddons: checkout.selectedAddons.map((addon) => ({
            name: addon.name,
            quantity: addon.quantity,
          })),
          couponCode: couponId ? couponCode.trim() : undefined,
        }),
      })
      const intentResult = (await intentResponse.json()) as
        | ServerBookingIntent
        | { error?: string }

      if (
        !intentResponse.ok ||
        !("intentId" in intentResult) ||
        !intentResult.orderId ||
        !intentResult.keyId
      ) {
        toast.error(
          ("error" in intentResult && intentResult.error) ||
            "Could not prepare booking payment."
        )
        setProcessing(false)
        return
      }

      const options = {
        key: intentResult.keyId,
        amount: intentResult.amount,
        currency: intentResult.currency || "INR",
        name:
          intentResult.displayName ||
          settings.razorpayDisplayName ||
          "Anga Function Hall",
        description: `Booking: ${listing.title}`,
        order_id: intentResult.orderId,
        prefill: {
          name: user.displayName || "",
          email: user.email || "",
        },
        handler: async (response: {
          razorpay_payment_id: string
          razorpay_order_id: string
          razorpay_signature: string
        }) => {
          try {
            setConfirming(true)
            const finalizeResult = await verifyPaymentAndConfirmBooking({
              intentId: intentResult.intentId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            })
            if (!finalizeResult?.bookingId) {
              throw new Error("Payment verified but booking confirmation failed.")
            }

            sessionStorage.removeItem("checkoutData")
            sessionStorage.setItem(
              "bookingConfirmation",
              JSON.stringify({
                bookingId: finalizeResult.bookingId,
                invoiceId: finalizeResult.invoiceId,
                invoiceNumber: finalizeResult.invoiceNumber,
                invoicePdfUrl: finalizeResult.invoicePdfUrl || "",
                allocatedLabels: finalizeResult.allocatedLabels || [],
                emailStatus: finalizeResult.emailStatus || "pending",
                listingTitle: listing.title,
                totalAmount: intentResult.pricing.totalAmount,
                advancePaid: intentResult.pricing.amountToPay,
              })
            )

            router.push("/checkout/success")
          } catch (error) {
            setConfirming(false)
            toast.error(
              error instanceof Error
                ? error.message
                : "Failed to create booking. Please contact support."
            )
          }
        },
        modal: {
          ondismiss: () => {
            setProcessing(false)
            setConfirming(false)
          },
        },
        theme: {
          color: "#3b5fc0",
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch {
      toast.error("Payment failed. Please try again.")
    } finally {
      setProcessing(false)
    }
  }

  const finalTotal = (checkout?.totalAmount || 0) - couponDiscount

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      </div>
    )
  }

  if (!checkout || !listing) return null

  const amountToPay =
    listing.paymentMode === "full"
      ? finalTotal
      : listing.paymentMode === "advance_fixed"
        ? Math.min(listing.advanceAmount, finalTotal)
        : Math.round(finalTotal * (listing.advanceAmount / 100))

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-secondary/30">
        <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
          <h1 className="mb-6 text-2xl font-bold text-foreground">
            Confirm Your Booking
          </h1>

          <div className="flex flex-col gap-6">
            {/* Booking Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Booking Details</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-1">
                    <h3 className="font-semibold text-foreground">
                      {listing.title}
                    </h3>
                    <Badge variant="secondary" className="w-fit">
                      {LISTING_TYPE_LABELS[listing.type]}
                    </Badge>
                  </div>
                </div>
                <Separator />
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="h-4 w-4 shrink-0" />
                    <span>{checkout.checkInDate}</span>
                  </div>
                  {branch && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span>{branch.name}, {branch.city}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4 shrink-0" />
                    <span>{checkout.guestCount} guest(s)</span>
                  </div>
                  {checkout.slotName && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4 shrink-0" />
                      <span>{checkout.slotName}</span>
                    </div>
                  )}
                </div>

                {checkout.selectedAddons.length > 0 && (
                  <>
                    <Separator />
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium text-foreground">
                        Add-ons
                      </p>
                      {checkout.selectedAddons.map((addon) => (
                        <div
                          key={addon.name}
                          className="flex justify-between text-sm text-muted-foreground"
                        >
                          <span>{addon.name}</span>
                          <span>{`\u20B9${addon.totalPrice.toLocaleString("en-IN")}`}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Coupon */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Apply Coupon
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    value={couponCode}
                    onChange={(e) =>
                      setCouponCode(e.target.value.toUpperCase())
                    }
                    placeholder="Enter coupon code"
                    disabled={!!couponId}
                  />
                  {couponId ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCouponCode("")
                        setCouponDiscount(0)
                        setCouponId(null)
                      }}
                    >
                      Remove
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={handleApplyCoupon}
                      disabled={applyingCoupon || !couponCode.trim()}
                    >
                      {applyingCoupon ? "Applying..." : "Apply"}
                    </Button>
                  )}
                </div>
                {couponDiscount > 0 && (
                  <p className="mt-2 text-sm text-emerald-600 font-medium">
                    {`Coupon applied! Saving \u20B9${couponDiscount.toLocaleString("en-IN")}`}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Price Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Price Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base price</span>
                  <span className="text-foreground">
                    {`\u20B9${checkout.basePrice.toLocaleString("en-IN")}`}
                  </span>
                </div>
                {checkout.addonsTotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Add-ons</span>
                    <span className="text-foreground">
                      {`\u20B9${checkout.addonsTotal.toLocaleString("en-IN")}`}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service fee</span>
                  <span className="text-foreground">
                    {`\u20B9${checkout.serviceFee.toLocaleString("en-IN")}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="text-foreground">
                    {`\u20B9${checkout.taxAmount.toLocaleString("en-IN")}`}
                  </span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Coupon discount</span>
                    <span>{`-\u20B9${couponDiscount.toLocaleString("en-IN")}`}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold text-base">
                  <span className="text-foreground">Total</span>
                  <span className="text-primary">
                    {`\u20B9${finalTotal.toLocaleString("en-IN")}`}
                  </span>
                </div>
                {listing.paymentMode !== "full" && (
                  <>
                    <Separator />
                    <div className="flex justify-between text-primary font-medium">
                      <span>Pay now (advance)</span>
                      <span>
                        {`\u20B9${amountToPay.toLocaleString("en-IN")}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Due at venue</span>
                      <span>
                        {`\u20B9${(finalTotal - amountToPay).toLocaleString("en-IN")}`}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Button
              size="lg"
              onClick={handlePayment}
              disabled={processing || confirming}
              className="w-full"
            >
              {confirming
                ? "Confirming your booking..."
                : processing
                  ? "Processing..."
                : `Pay \u20B9${amountToPay.toLocaleString("en-IN")}`}
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
