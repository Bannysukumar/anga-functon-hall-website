"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useAuth } from "@/lib/hooks/use-auth"
import { PermissionGuard } from "@/components/auth/permission-guard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

type BookingItem = {
  id: string
  invoiceNumber?: string
  listingTitle?: string
  branchName?: string
  status?: string
  paymentStatus?: string
  guestCount?: number
  totalAmount?: number
  advancePaid?: number
  dueAmount?: number
  bookingNotes?: string
  cancellationReason?: string
  createdAt?: { toDate?: () => Date }
  updatedAt?: { toDate?: () => Date }
  checkInDate?: { toDate?: () => Date }
  checkOutDate?: { toDate?: () => Date }
}

type PaymentItem = {
  id: string
  bookingId?: string
  invoiceNumber?: string
  status?: string
  gateway?: string
  amount?: number
  totalAmount?: number
  method?: string
  note?: string
  updatedAt?: { toDate?: () => Date }
  createdAt?: { toDate?: () => Date }
}

type CustomerProfile = {
  id: string
  name?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  source?: "customers" | "users"
  role?: string
  isActive?: boolean
  createdBy?: string
  updatedBy?: string
  createdAt?: { toDate?: () => Date }
  updatedAt?: { toDate?: () => Date }
}

function formatDateTime(value?: { toDate?: () => Date } | null) {
  if (!value?.toDate) return "-"
  return format(value.toDate(), "dd MMM yyyy, hh:mm a")
}

function formatMoney(value: number | undefined) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`
}

export default function ReceptionistCustomerProfilePage() {
  const { user } = useAuth()
  const params = useParams()
  const id = params.id as string
  const [customer, setCustomer] = useState<CustomerProfile | null>(null)
  const [bookings, setBookings] = useState<BookingItem[]>([])
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!user || !id) return
      try {
        setLoading(true)
        const response = await fetch(`/api/receptionist/customers/${id}`, {
          headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        })
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || "Failed to load customer")
        setCustomer(json.customer || null)
        setBookings(json.bookings || [])
        setPayments(json.payments || [])
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load customer")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, user])

  const bookingSummary = useMemo(() => {
    const totalBookings = bookings.length
    const confirmed = bookings.filter((item) => item.status === "confirmed").length
    const checkedIn = bookings.filter((item) => item.status === "checked_in").length
    const checkedOut = bookings.filter((item) => item.status === "checked_out").length
    const cancelled = bookings.filter((item) => item.status === "cancelled").length
    const totalBookingAmount = bookings.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0)
    const totalAdvance = bookings.reduce((sum, item) => sum + Number(item.advancePaid || 0), 0)
    const totalDue = bookings.reduce((sum, item) => sum + Number(item.dueAmount || 0), 0)
    return {
      totalBookings,
      confirmed,
      checkedIn,
      checkedOut,
      cancelled,
      totalBookingAmount,
      totalAdvance,
      totalDue,
    }
  }, [bookings])

  const paymentSummary = useMemo(() => {
    const totalPayments = payments.length
    const totalPaid = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const methods = Array.from(
      new Set(payments.map((item) => String(item.method || "cash").toLowerCase()))
    )
    return { totalPayments, totalPaid, methods }
  }, [payments])

  return (
    <PermissionGuard requiredPermissions={["view_customers"]} allowedRoles={["admin", "receptionist"]}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{customer?.name || "Customer Profile"}</h1>
            <p className="text-sm text-muted-foreground">Customer details, bookings and payments history.</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/receptionist/customers">Back</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {loading ? (
              <p className="text-muted-foreground">Loading customer profile...</p>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Total Bookings</p>
                    <p className="text-lg font-semibold">{bookingSummary.totalBookings}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Total Booking Value</p>
                    <p className="text-lg font-semibold">{formatMoney(bookingSummary.totalBookingAmount)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Total Paid</p>
                    <p className="text-lg font-semibold">{formatMoney(paymentSummary.totalPaid)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Outstanding Due</p>
                    <p className="text-lg font-semibold">{formatMoney(bookingSummary.totalDue)}</p>
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <p><span className="font-medium">Customer ID:</span> {customer?.id || "-"}</p>
                  <p><span className="font-medium">Name:</span> {customer?.name || "-"}</p>
                  <p><span className="font-medium">Phone:</span> {customer?.phone || "-"}</p>
                  <p><span className="font-medium">Email:</span> {customer?.email || "-"}</p>
                  <p><span className="font-medium">Address:</span> {customer?.address || "-"}</p>
                  <p><span className="font-medium">Source:</span> {customer?.source || "-"}</p>
                  <p><span className="font-medium">Role:</span> {customer?.role || "user"}</p>
                  <p>
                    <span className="font-medium">Status:</span>{" "}
                    <Badge variant={customer?.isActive === false ? "destructive" : "default"}>
                      {customer?.isActive === false ? "Inactive" : "Active"}
                    </Badge>
                  </p>
                  <p><span className="font-medium">Created By:</span> {customer?.createdBy || "-"}</p>
                  <p><span className="font-medium">Updated By:</span> {customer?.updatedBy || "-"}</p>
                  <p><span className="font-medium">Created At:</span> {formatDateTime(customer?.createdAt)}</p>
                  <p><span className="font-medium">Updated At:</span> {formatDateTime(customer?.updatedAt)}</p>
                </div>
                <p><span className="font-medium">Notes:</span> {customer?.notes || "-"}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bookings History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings found.</p>
            ) : (
              <>
                <div className="grid gap-3 rounded-lg border p-3 text-xs md:grid-cols-4">
                  <p><span className="font-medium">Confirmed:</span> {bookingSummary.confirmed}</p>
                  <p><span className="font-medium">Checked-in:</span> {bookingSummary.checkedIn}</p>
                  <p><span className="font-medium">Checked-out:</span> {bookingSummary.checkedOut}</p>
                  <p><span className="font-medium">Cancelled:</span> {bookingSummary.cancelled}</p>
                  <p><span className="font-medium">Total:</span> {formatMoney(bookingSummary.totalBookingAmount)}</p>
                  <p><span className="font-medium">Advance:</span> {formatMoney(bookingSummary.totalAdvance)}</p>
                  <p><span className="font-medium">Due:</span> {formatMoney(bookingSummary.totalDue)}</p>
                  <p><span className="font-medium">Count:</span> {bookingSummary.totalBookings}</p>
                </div>
                {bookings.map((booking) => (
                <div key={booking.id} className="rounded-lg border p-3">
                    <p className="font-medium">{booking.listingTitle || booking.id}</p>
                    <div className="mt-1 grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
                      <p><span className="font-medium">Booking ID:</span> {booking.id}</p>
                      <p><span className="font-medium">Invoice:</span> {booking.invoiceNumber || "-"}</p>
                      <p><span className="font-medium">Branch:</span> {booking.branchName || "-"}</p>
                      <p><span className="font-medium">Guests:</span> {booking.guestCount || 0}</p>
                      <p><span className="font-medium">Status:</span> {booking.status || "-"}</p>
                      <p><span className="font-medium">Payment Status:</span> {booking.paymentStatus || "-"}</p>
                      <p><span className="font-medium">Check-in:</span> {formatDateTime(booking.checkInDate)}</p>
                      <p><span className="font-medium">Check-out:</span> {formatDateTime(booking.checkOutDate)}</p>
                      <p><span className="font-medium">Created At:</span> {formatDateTime(booking.createdAt)}</p>
                      <p><span className="font-medium">Updated At:</span> {formatDateTime(booking.updatedAt)}</p>
                      <p><span className="font-medium">Total:</span> {formatMoney(booking.totalAmount)}</p>
                      <p><span className="font-medium">Advance:</span> {formatMoney(booking.advancePaid)}</p>
                      <p><span className="font-medium">Due:</span> {formatMoney(booking.dueAmount)}</p>
                      <p><span className="font-medium">Cancellation Reason:</span> {booking.cancellationReason || "-"}</p>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      <span className="font-medium">Notes:</span> {booking.bookingNotes || "-"}
                    </p>
                </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payments History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments found.</p>
            ) : (
              <>
                <div className="grid gap-3 rounded-lg border p-3 text-xs md:grid-cols-3">
                  <p><span className="font-medium">Total Payments:</span> {paymentSummary.totalPayments}</p>
                  <p><span className="font-medium">Total Paid:</span> {formatMoney(paymentSummary.totalPaid)}</p>
                  <p><span className="font-medium">Methods Used:</span> {paymentSummary.methods.join(", ") || "-"}</p>
                </div>
                {payments.map((payment) => (
                <div key={payment.id} className="rounded-lg border p-3">
                    <p className="font-medium">{formatMoney(payment.amount)}</p>
                    <div className="mt-1 grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
                      <p><span className="font-medium">Payment ID:</span> {payment.id}</p>
                      <p><span className="font-medium">Booking ID:</span> {payment.bookingId || "-"}</p>
                      <p><span className="font-medium">Invoice:</span> {payment.invoiceNumber || "-"}</p>
                      <p><span className="font-medium">Method:</span> {payment.method || "cash"}</p>
                      <p><span className="font-medium">Status:</span> {payment.status || "-"}</p>
                      <p><span className="font-medium">Gateway:</span> {payment.gateway || "-"}</p>
                      <p><span className="font-medium">Amount:</span> {formatMoney(payment.amount)}</p>
                      <p><span className="font-medium">Total Amount:</span> {formatMoney(payment.totalAmount)}</p>
                      <p><span className="font-medium">Created At:</span> {formatDateTime(payment.createdAt)}</p>
                      <p><span className="font-medium">Updated At:</span> {formatDateTime(payment.updatedAt)}</p>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      <span className="font-medium">Note:</span> {payment.note || "-"}
                    </p>
                </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  )
}
