"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { getBooking, getUser } from "@/lib/firebase-db"
import type { AppUser, Booking } from "@/lib/types"
import {
  BOOKING_STATUS_COLORS,
  BOOKING_STATUS_LABELS,
  LISTING_TYPE_LABELS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export default function AdminBookingDetailsPage() {
  const params = useParams()
  const bookingId = String(params.id || "")
  const [booking, setBooking] = useState<Booking | null>(null)
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const bookingData = await getBooking(bookingId)
        setBooking(bookingData)
        if (bookingData?.userId) {
          const userData = await getUser(bookingData.userId)
          setUser(userData)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [bookingId])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!booking) {
    return <p className="text-sm text-muted-foreground">Booking not found.</p>
  }

  const checkIn = booking.checkInDate?.toDate
    ? booking.checkInDate.toDate().toLocaleString("en-IN")
    : "N/A"
  const checkOut = booking.checkOutDate?.toDate
    ? booking.checkOutDate.toDate().toLocaleString("en-IN")
    : "-"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Booking Details</h1>
          <p className="font-mono text-xs text-muted-foreground">{booking.id}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/bookings">Back</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p><span className="font-medium">Name:</span> {booking.customerName || user?.displayName || "-"}</p>
          <p><span className="font-medium">Phone:</span> {booking.customerPhone || user?.phone || user?.mobileNumber || "-"}</p>
          <p><span className="font-medium">Email:</span> {booking.customerEmail || user?.email || "-"}</p>
          <p><span className="font-medium">Guests:</span> {booking.guestCount}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Booking Info</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p><span className="font-medium">Listing Type:</span> {LISTING_TYPE_LABELS[booking.listingType] || booking.listingType}</p>
          <p><span className="font-medium">Room/Hall:</span> {booking.roomNumber ? `Room ${booking.roomNumber}` : booking.listingTitle}</p>
          <p><span className="font-medium">Booked Rooms:</span> {(booking.selectedRoomNumbers || []).join(", ") || "-"}</p>
          <p><span className="font-medium">Check-in:</span> {checkIn}</p>
          <p><span className="font-medium">Check-out:</span> {checkOut}</p>
          <p><span className="font-medium">Amount:</span> ₹{Number(booking.totalAmount || 0).toLocaleString("en-IN")}</p>
          <p><span className="font-medium">Payment Txn ID:</span> {booking.razorpayPaymentId || "-"}</p>
          <div className="flex items-center gap-2">
            <span className="font-medium">Payment Status:</span>
            <Badge variant="outline" className={PAYMENT_STATUS_COLORS[booking.paymentStatus]}>
              {PAYMENT_STATUS_LABELS[booking.paymentStatus]}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium">Booking Status:</span>
            <Badge variant="secondary" className={BOOKING_STATUS_COLORS[booking.status]}>
              {BOOKING_STATUS_LABELS[booking.status]}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
