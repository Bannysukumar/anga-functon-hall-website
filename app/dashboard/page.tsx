"use client"

import { useAuth } from "@/lib/hooks/use-auth"
import { getBookings } from "@/lib/firebase-db"
import type { Booking } from "@/lib/types"
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
} from "@/lib/constants"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CalendarDays,
  MapPin,
  Loader2,
  Eye,
  CalendarX,
} from "lucide-react"

export default function DashboardBookingsPage() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const data = await getBookings({ userId: user.uid })
        setBookings(data)
      } catch (err) {
        console.error("Error loading bookings:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const filteredBookings =
    statusFilter === "all"
      ? bookings
      : bookings.filter((b) => b.status === statusFilter)

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Bookings</h1>
          <p className="text-sm text-muted-foreground">
            View and manage all your bookings
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Bookings</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredBookings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CalendarX className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">
              No bookings found
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {statusFilter === "all"
                ? "You haven't made any bookings yet."
                : `No ${statusFilter} bookings.`}
            </p>
            <Button asChild className="mt-4">
              <Link href="/explore">Explore Venues</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredBookings.map((booking) => {
            const checkInDate = booking.checkInDate?.toDate
              ? booking.checkInDate.toDate().toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "N/A"
            return (
              <Card key={booking.id} className="transition-shadow hover:shadow-md">
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-foreground">
                        {booking.listingTitle}
                      </h3>
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
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {booking.branchName}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {checkInDate}
                        {booking.slotName && ` - ${booking.slotName}`}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">
                      Total:{" "}
                      <span className="font-semibold">
                        {"₹"}
                        {booking.totalAmount.toLocaleString("en-IN")}
                      </span>
                      {booking.dueAmount > 0 && (
                        <span className="ml-2 text-amber-600">
                          (Due: {"₹"}{booking.dueAmount.toLocaleString("en-IN")})
                        </span>
                      )}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/bookings/${booking.id}`}>
                      <Eye className="mr-1.5 h-4 w-4" />
                      View Details
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
