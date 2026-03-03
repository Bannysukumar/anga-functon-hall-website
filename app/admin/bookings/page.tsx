"use client"

import { getBookings, updateBooking } from "@/lib/firebase-db"
import type { Booking } from "@/lib/types"
import Link from "next/link"
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
} from "@/lib/constants"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  CalendarDays,
  Loader2,
  MoreHorizontal,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/hooks/use-auth"
import {
  resendBookingConfirmationEmail,
  adminCheckIn,
  adminCheckOut,
  resendCheckoutEmail,
} from "@/lib/booking-functions"

export default function AdminBookingsPage() {
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { hasPermission, isAdminUser } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const userIdFilter = searchParams.get("userId") || ""
  const userEmailFilter = searchParams.get("userEmail") || ""

  const loadBookings = async () => {
    setLoading(true)
    try {
      const data = await getBookings(
        userIdFilter ? { userId: userIdFilter } : undefined
      )
      setBookings(data)
    } catch (err) {
      console.error("Error loading bookings:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBookings()
  }, [userIdFilter])

  const handleStatusUpdate = async (
    bookingId: string,
    newStatus: string,
    newPaymentStatus?: string
  ) => {
    if (!isAdminUser && !hasPermission("BOOKINGS_UPDATE_STATUS")) {
      toast({
        title: "Permission denied",
        description: "You do not have permission to update booking status.",
        variant: "destructive",
      })
      return
    }
    try {
      const update: Partial<Booking> = {
        status: newStatus as Booking["status"],
      }
      if (newPaymentStatus) {
        update.paymentStatus = newPaymentStatus as Booking["paymentStatus"]
      }
      await updateBooking(bookingId, update)
      toast({ title: `Booking updated to ${BOOKING_STATUS_LABELS[newStatus]}` })
      loadBookings()
    } catch {
      toast({
        title: "Error",
        description: "Failed to update booking.",
        variant: "destructive",
      })
    }
  }

  const handleRefundApproval = async (bookingId: string) => {
    if (!isAdminUser && !hasPermission("REFUNDS_MANAGE")) {
      toast({
        title: "Permission denied",
        description: "You do not have permission to manage refunds.",
        variant: "destructive",
      })
      return
    }
    try {
      await updateBooking(bookingId, {
        refundStatus: "approved",
        paymentStatus: "refunded",
      })
      toast({ title: "Refund approved" })
      loadBookings()
    } catch {
      toast({
        title: "Error",
        description: "Failed to approve refund.",
        variant: "destructive",
      })
    }
  }

  const handleResendEmail = async (bookingId: string) => {
    try {
      const result = await resendBookingConfirmationEmail(bookingId)
      toast({
        title: "Email status updated",
        description: `Confirmation email: ${result.emailStatus}`,
      })
      loadBookings()
    } catch {
      toast({
        title: "Error",
        description: "Failed to resend confirmation email.",
        variant: "destructive",
      })
    }
  }

  const handleForceResendEmail = async (bookingId: string) => {
    try {
      const result = await resendBookingConfirmationEmail(bookingId, true)
      toast({
        title: "Email resent",
        description: `Confirmation email: ${result.emailStatus}`,
      })
      loadBookings()
    } catch {
      toast({
        title: "Error",
        description: "Failed to force resend confirmation email.",
        variant: "destructive",
      })
    }
  }

  const filtered = bookings.filter((b) => {
    const matchStatus =
      statusFilter === "all" || b.status === statusFilter
    const matchSearch =
      searchQuery === "" ||
      b.listingTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.branchName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.id.toLowerCase().includes(searchQuery.toLowerCase())
    return matchStatus && matchSearch
  })

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
          <h1 className="text-2xl font-bold text-foreground">Bookings</h1>
          <p className="text-sm text-muted-foreground">
            {bookings.length} total bookings
          </p>
          {userIdFilter && (
            <p className="text-xs text-muted-foreground">
              Filtered by user: {userEmailFilter || userIdFilter}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {userIdFilter && (
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/bookings">View All</Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={loadBookings}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by title, branch, or invoice..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="checked_in">Checked In</SelectItem>
                <SelectItem value="checked_out">Checked Out</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Listing</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Allocation / Invoice</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No bookings found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((booking) => {
                    const dateStr = booking.checkInDate?.toDate
                      ? booking.checkInDate
                          .toDate()
                          .toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })
                      : "N/A"

                    return (
                      <TableRow key={booking.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">
                              {booking.listingTitle}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {booking.branchName}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {dateStr}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-medium text-foreground">
                              {"₹"}{booking.totalAmount.toLocaleString("en-IN")}
                            </p>
                            {booking.dueAmount > 0 && (
                              <p className="text-xs text-amber-600">
                                Due: {"₹"}{booking.dueAmount.toLocaleString("en-IN")}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={BOOKING_STATUS_COLORS[booking.status]}
                          >
                            {BOOKING_STATUS_LABELS[booking.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              PAYMENT_STATUS_COLORS[booking.paymentStatus]
                            }
                          >
                            {PAYMENT_STATUS_LABELS[booking.paymentStatus]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground">
                            <p>
                              {(booking.allocatedResource?.labels || [])
                                .slice(0, 2)
                                .join(", ") || "-"}
                            </p>
                            {booking.invoiceNumber && (
                              <p className="font-mono text-[10px] text-foreground">
                                {booking.invoiceNumber}
                              </p>
                            )}
                            <p>
                              Payment Verified: {booking.paymentVerified ? "Yes" : "No"}
                            </p>
                            <p>
                              Email: {booking.emailStatus || "pending"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {booking.status === "pending" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleStatusUpdate(
                                      booking.id,
                                      "confirmed"
                                    )
                                  }
                                  disabled={!isAdminUser && !hasPermission("BOOKINGS_UPDATE_STATUS")}
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Confirm
                                </DropdownMenuItem>
                              )}
                              {booking.status === "confirmed" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleStatusUpdate(
                                      booking.id,
                                      "completed",
                                      "fully_paid"
                                    )
                                  }
                                  disabled={!isAdminUser && !hasPermission("BOOKINGS_UPDATE_STATUS")}
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Mark Completed
                                </DropdownMenuItem>
                              )}
                              {(booking.status === "pending" ||
                                booking.status === "confirmed") && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleStatusUpdate(
                                      booking.id,
                                      "cancelled"
                                    )
                                  }
                                  disabled={!isAdminUser && !hasPermission("BOOKINGS_UPDATE_STATUS")}
                                  className="text-destructive"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Cancel
                                </DropdownMenuItem>
                              )}
                              {booking.refundStatus === "requested" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleRefundApproval(booking.id)
                                  }
                                  disabled={!isAdminUser && !hasPermission("REFUNDS_MANAGE")}
                                >
                                  <Clock className="mr-2 h-4 w-4" />
                                  Approve Refund
                                </DropdownMenuItem>
                              )}
                              {booking.paymentStatus === "advance_paid" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleStatusUpdate(
                                      booking.id,
                                      booking.status,
                                      "fully_paid"
                                    )
                                  }
                                  disabled={!isAdminUser && !hasPermission("BOOKINGS_UPDATE_STATUS")}
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Mark Fully Paid
                                </DropdownMenuItem>
                              )}
                              {booking.status === "confirmed" && (
                                <DropdownMenuItem
                                  onClick={async () => {
                                    try {
                                      await adminCheckIn(booking.id)
                                      toast({ title: "Check-in marked" })
                                      loadBookings()
                                    } catch {
                                      toast({
                                        title: "Error",
                                        description: "Failed to mark check-in.",
                                        variant: "destructive",
                                      })
                                    }
                                  }}
                                  disabled={!isAdminUser}
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Mark Check-In
                                </DropdownMenuItem>
                              )}
                              {(booking.status === "checked_in" || booking.status === "confirmed") && (
                                <DropdownMenuItem
                                  onClick={async () => {
                                    try {
                                      await adminCheckOut(booking.id, "Admin checkout")
                                      toast({ title: "Check-out marked" })
                                      loadBookings()
                                    } catch {
                                      toast({
                                        title: "Error",
                                        description: "Failed to mark check-out.",
                                        variant: "destructive",
                                      })
                                    }
                                  }}
                                  disabled={!isAdminUser}
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Mark Check-Out
                                </DropdownMenuItem>
                              )}
                              {booking.status === "checked_out" && (
                                <DropdownMenuItem
                                  onClick={async () => {
                                    try {
                                      const result = await resendCheckoutEmail(booking.id)
                                      toast({
                                        title: "Checkout email status",
                                        description: result.checkoutEmailStatus,
                                      })
                                      loadBookings()
                                    } catch {
                                      toast({
                                        title: "Error",
                                        description: "Failed to resend checkout email.",
                                        variant: "destructive",
                                      })
                                    }
                                  }}
                                  disabled={!isAdminUser}
                                >
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  Resend Checkout Email
                                </DropdownMenuItem>
                              )}
                              {booking.status === "confirmed" && (
                                <DropdownMenuItem
                                  onClick={() => handleResendEmail(booking.id)}
                                  disabled={!isAdminUser}
                                >
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  Resend Email
                                </DropdownMenuItem>
                              )}
                              {booking.status === "confirmed" && booking.emailStatus === "sent" && (
                                <DropdownMenuItem
                                  onClick={() => handleForceResendEmail(booking.id)}
                                  disabled={!isAdminUser}
                                >
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  Force Resend Email
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
