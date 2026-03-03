"use client"

import { useEffect, useMemo, useState } from "react"
import { getBookings } from "@/lib/firebase-db"
import type { Booking } from "@/lib/types"
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2, Search, Wallet, CircleDollarSign, HandCoins } from "lucide-react"

export default function AdminPaymentsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await getBookings()
        setBookings(data)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const paidTotal = useMemo(
    () =>
      bookings
        .filter((booking) => booking.paymentStatus === "fully_paid")
        .reduce((total, booking) => total + (booking.totalAmount || 0), 0),
    [bookings]
  )

  const advanceCollected = useMemo(
    () =>
      bookings
        .filter((booking) => booking.paymentStatus === "advance_paid")
        .reduce((total, booking) => total + (booking.advancePaid || 0), 0),
    [bookings]
  )

  const refunds = useMemo(
    () =>
      bookings
        .filter((booking) => booking.paymentStatus === "refunded")
        .reduce((total, booking) => total + (booking.refundAmount || 0), 0),
    [bookings]
  )

  const filtered = useMemo(() => {
    if (!search.trim()) return bookings
    const query = search.toLowerCase()
    return bookings.filter(
      (booking) =>
        booking.listingTitle?.toLowerCase().includes(query) ||
        booking.branchName?.toLowerCase().includes(query) ||
        booking.invoiceNumber?.toLowerCase().includes(query) ||
        booking.id.toLowerCase().includes(query)
    )
  }, [bookings, search])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Payment overview and transaction statuses
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <CircleDollarSign className="h-6 w-6 text-emerald-600" />
            <div>
              <p className="text-xs text-muted-foreground">Fully Paid Total</p>
              <p className="text-lg font-semibold">₹{paidTotal.toLocaleString("en-IN")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <Wallet className="h-6 w-6 text-amber-600" />
            <div>
              <p className="text-xs text-muted-foreground">Advance Collected</p>
              <p className="text-lg font-semibold">
                ₹{advanceCollected.toLocaleString("en-IN")}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <HandCoins className="h-6 w-6 text-sky-600" />
            <div>
              <p className="text-xs text-muted-foreground">Refunded</p>
              <p className="text-lg font-semibold">₹{refunds.toLocaleString("en-IN")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Transactions</CardTitle>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by title, invoice, branch..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Listing</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Advance</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Payment Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      No payment records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{booking.listingTitle}</p>
                          <p className="text-xs text-muted-foreground">{booking.branchName}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {booking.invoiceNumber || booking.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>₹{booking.totalAmount.toLocaleString("en-IN")}</TableCell>
                      <TableCell>₹{(booking.advancePaid || 0).toLocaleString("en-IN")}</TableCell>
                      <TableCell>₹{(booking.dueAmount || 0).toLocaleString("en-IN")}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={PAYMENT_STATUS_COLORS[booking.paymentStatus]}
                        >
                          {PAYMENT_STATUS_LABELS[booking.paymentStatus]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
