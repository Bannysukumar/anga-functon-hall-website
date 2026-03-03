"use client"

import { useAuth } from "@/lib/hooks/use-auth"
import { getBooking, getInvoice, updateBooking } from "@/lib/firebase-db"
import type { Booking, Invoice } from "@/lib/types"
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  LISTING_TYPE_LABELS,
} from "@/lib/constants"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  CalendarDays,
  MapPin,
  Users,
  Loader2,
  ArrowLeft,
  XCircle,
  Receipt,
  Clock,
  Hash,
} from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"

export default function BookingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const id = params.id as string
        const data = await getBooking(id)
        if (data && data.userId === user?.uid) {
          setBooking(data)
          if (data.invoiceId) {
            const invoiceData = await getInvoice(data.invoiceId)
            setInvoice(invoiceData)
          }
        }
      } catch (err) {
        console.error("Error loading booking:", err)
      } finally {
        setLoading(false)
      }
    }
    if (user) load()
  }, [params.id, user])

  const handleCancel = async () => {
    if (!booking) return
    setCancelling(true)
    try {
      await updateBooking(booking.id, {
        status: "cancelled",
        paymentStatus: booking.advancePaid > 0 ? "refund_requested" : "pending",
        refundStatus: booking.advancePaid > 0 ? "requested" : "none",
      })
      toast({
        title: "Booking Cancelled",
        description: "Your booking has been cancelled. Refund will be processed if applicable.",
      })
      router.push("/dashboard")
    } catch {
      toast({
        title: "Error",
        description: "Failed to cancel booking. Please try again.",
        variant: "destructive",
      })
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <h2 className="text-xl font-semibold text-foreground">Booking not found</h2>
        <Button asChild variant="outline">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Bookings
          </Link>
        </Button>
      </div>
    )
  }

  const checkIn = booking.checkInDate?.toDate
    ? booking.checkInDate.toDate().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "N/A"

  const checkOut = booking.checkOutDate?.toDate
    ? booking.checkOutDate.toDate().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null

  const canCancel =
    booking.status === "pending" || booking.status === "confirmed"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Booking Details</h1>
          <p className="text-sm text-muted-foreground">
            {booking.invoiceNumber || booking.id}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Details */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>{booking.listingTitle}</CardTitle>
                <div className="flex gap-2">
                  <Badge
                    variant="secondary"
                    className={BOOKING_STATUS_COLORS[booking.status]}
                  >
                    {BOOKING_STATUS_LABELS[booking.status]}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={PAYMENT_STATUS_COLORS[booking.paymentStatus]}
                  >
                    {PAYMENT_STATUS_LABELS[booking.paymentStatus]}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Branch</p>
                  <p className="text-sm font-medium text-foreground">{booking.branchName}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Hash className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="text-sm font-medium text-foreground">
                    {LISTING_TYPE_LABELS[booking.listingType]}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Check-in</p>
                  <p className="text-sm font-medium text-foreground">{checkIn}</p>
                </div>
              </div>
              {checkOut && (
                <div className="flex items-start gap-3">
                  <CalendarDays className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Check-out</p>
                    <p className="text-sm font-medium text-foreground">{checkOut}</p>
                  </div>
                </div>
              )}
              {booking.slotName && (
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Slot</p>
                    <p className="text-sm font-medium text-foreground">{booking.slotName}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <Users className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Guests / Units</p>
                  <p className="text-sm font-medium text-foreground">
                    {booking.guestCount} guests, {booking.unitsBooked} unit(s)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Addons */}
          {booking.allocatedResource && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Allocated Details</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground">
                  {(booking.allocatedResource.labels || []).join(", ") || "Allocated"}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Addons */}
          {booking.selectedAddons && booking.selectedAddons.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Add-ons</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {booking.selectedAddons.map((addon, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        {addon.name} x {addon.quantity}
                      </span>
                      <span className="font-medium text-foreground">
                        {"₹"}{addon.totalPrice.toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Price Breakdown */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-4 w-4" />
                Price Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {invoice?.id && (
                <Button asChild variant="secondary" className="w-full">
                  <Link href={`/invoice/${invoice.id}`}>
                    <Receipt className="mr-2 h-4 w-4" />
                    Download Invoice PDF
                  </Link>
                </Button>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Base Price</span>
                <span className="text-foreground">{"₹"}{booking.basePrice.toLocaleString("en-IN")}</span>
              </div>
              {booking.addonsTotal > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Add-ons</span>
                  <span className="text-foreground">{"₹"}{booking.addonsTotal.toLocaleString("en-IN")}</span>
                </div>
              )}
              {booking.couponDiscount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Coupon Discount</span>
                  <span className="text-emerald-600">
                    -{"₹"}{booking.couponDiscount.toLocaleString("en-IN")}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span className="text-foreground">{"₹"}{booking.taxAmount.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Service Fee</span>
                <span className="text-foreground">{"₹"}{booking.serviceFee.toLocaleString("en-IN")}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between font-semibold">
                <span className="text-foreground">Total</span>
                <span className="text-foreground">{"₹"}{booking.totalAmount.toLocaleString("en-IN")}</span>
              </div>
              {booking.advancePaid > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Advance Paid</span>
                    <span className="text-emerald-600">
                      {"₹"}{booking.advancePaid.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span className="text-amber-600">Due Amount</span>
                    <span className="text-amber-600">
                      {"₹"}{booking.dueAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {canCancel && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Booking
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. If you paid an advance,
                    a refund request will be submitted for review.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {cancelling ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Yes, Cancel
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  )
}
