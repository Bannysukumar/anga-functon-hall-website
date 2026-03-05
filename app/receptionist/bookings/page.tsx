"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { PermissionGuard } from "@/components/auth/permission-guard"
import { useAuth } from "@/lib/hooks/use-auth"
import { getListings } from "@/lib/firebase-db"
import type { Booking, Listing } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { HallAvailabilityChecker } from "@/components/receptionist/hall-availability-checker"

type Customer = { id: string; name: string; phone: string }

function formatBookingTimestamp(value: unknown): string {
  if (!value) return "-"
  const d =
    typeof (value as { toDate?: () => Date }).toDate === "function"
      ? (value as { toDate: () => Date }).toDate()
      : typeof (value as { seconds?: number }).seconds === "number"
        ? new Date((value as { seconds: number }).seconds * 1000)
        : null
  return d && !Number.isNaN(d.getTime()) ? format(d, "dd MMM yyyy hh:mm a") : "-"
}

function formatBookingTime(value: unknown): string {
  if (!value) return "-"
  const d =
    typeof (value as { toDate?: () => Date }).toDate === "function"
      ? (value as { toDate: () => Date }).toDate()
      : typeof (value as { seconds?: number }).seconds === "number"
        ? new Date((value as { seconds: number }).seconds * 1000)
        : null
  return d && !Number.isNaN(d.getTime()) ? format(d, "dd MMM hh:mm a") : "-"
}

function formatBookingDate(value: unknown): string {
  if (!value) return "-"
  const d =
    typeof (value as { toDate?: () => Date }).toDate === "function"
      ? (value as { toDate: () => Date }).toDate()
      : typeof (value as { seconds?: number }).seconds === "number"
        ? new Date((value as { seconds: number }).seconds * 1000)
        : null
  return d && !Number.isNaN(d.getTime()) ? format(d, "dd MMM yyyy") : "-"
}

export default function ReceptionistBookingsPage() {
  const { user, hasPermission, isAdminUser } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loadingBookings, setLoadingBookings] = useState(false)
  const [listings, setListings] = useState<Listing[]>([])
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [form, setForm] = useState({
    customerId: "",
    listingId: "",
    functionDateTime: "",
    guestCount: 1,
    advanceAmount: 0,
    totalAmount: 0,
    paymentMethod: "cash",
    notes: "",
  })
  const [conflictWarning, setConflictWarning] = useState("")

  async function loadCustomers() {
    if (!user) return
    const response = await fetch("/api/receptionist/customers?limit=100", {
      headers: { Authorization: `Bearer ${await user.getIdToken()}` },
    })
    const json = await response.json()
    if (!response.ok) throw new Error(json.error || "Failed to load customers")
    setCustomers(json.items || [])
  }

  async function loadBookings() {
    if (!user) return
    setLoadingBookings(true)
    try {
      const response = await fetch(
        `/api/receptionist/bookings?status=${encodeURIComponent(status)}&search=${encodeURIComponent(
          search
        )}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}&page=1&limit=100`,
        {
          headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        }
      )
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to load bookings")
      setBookings(json.items || [])
    } finally {
      setLoadingBookings(false)
    }
  }

  useEffect(() => {
    if (!user) return
    getListings().then(setListings).catch(() => setListings([]))
    loadCustomers().catch((error) => toast.error(error.message))
    loadBookings().catch((error) => toast.error(error.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    async function checkConflict() {
      if (!user || !form.functionDateTime || !form.listingId) {
        setConflictWarning("")
        return
      }
      try {
        const listing = listings.find((item) => item.id === form.listingId)
        const hallType = listing?.type || "all"
        const response = await fetch(
          `/api/receptionist/availability?date=${encodeURIComponent(form.functionDateTime)}&hallType=${encodeURIComponent(hallType)}`,
          { headers: { Authorization: `Bearer ${await user.getIdToken()}` } }
        )
        const json = await response.json()
        if (!response.ok) return
        if (json.status === "BOOKED") {
          setConflictWarning("Conflict warning: booking already exists for this date/hall type.")
          return
        }
        setConflictWarning("")
      } catch {
        setConflictWarning("")
      }
    }
    checkConflict()
  }, [form.functionDateTime, form.listingId, user, listings])

  async function createBooking() {
    if (!user) return
    try {
      const response = await fetch("/api/receptionist/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify(form),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to create booking")
      toast.success(`Booking created (${json.invoiceNumber})`)
      setForm({
        customerId: "",
        listingId: "",
        functionDateTime: "",
        guestCount: 1,
        advanceAmount: 0,
        totalAmount: 0,
        paymentMethod: "cash",
        notes: "",
      })
      await loadBookings()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create booking")
    }
  }

  async function doAction(
    bookingId: string,
    action: "edit" | "cancel" | "check_in" | "check_out",
    payload: Record<string, unknown> = {}
  ) {
    if (!user) return
    try {
      const response = await fetch(`/api/receptionist/bookings/${bookingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({ action, ...payload }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Action failed")
      toast.success("Booking updated")
      await loadBookings()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed")
    }
  }

  async function sendWhatsapp(bookingId: string, kind: "confirmation" | "reminder" = "confirmation") {
    if (!user) return
    try {
      const response = await fetch(`/api/receptionist/bookings/${bookingId}/whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({ kind }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to send WhatsApp")
      toast.success("WhatsApp message sent")
      await loadBookings()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send WhatsApp")
    }
  }

  async function confirmAndRun(
    bookingId: string,
    action: "cancel" | "check_in" | "check_out",
    payload: Record<string, unknown> = {}
  ) {
    const messages: Record<"cancel" | "check_in" | "check_out", string> = {
      cancel: "Are you sure you want to cancel this booking?",
      check_in: "Confirm check-in for this booking?",
      check_out: "Confirm check-out for this booking?",
    }
    if (!window.confirm(messages[action])) return
    await doAction(bookingId, action, payload)
  }

  function printReceipt(booking: Booking) {
    const receiptHtml = `
      <html>
        <head><title>Booking Receipt ${booking.invoiceNumber || booking.id}</title></head>
        <body style="font-family: Arial, sans-serif; padding: 24px;">
          <h2>Booking Receipt</h2>
          <p><strong>Invoice:</strong> ${booking.invoiceNumber || booking.id}</p>
          <p><strong>Listing:</strong> ${booking.listingTitle}</p>
          <p><strong>Branch:</strong> ${booking.branchName}</p>
          <p><strong>Date:</strong> ${
            booking.checkInDate?.toDate
              ? format(booking.checkInDate.toDate(), "dd MMM yyyy, hh:mm a")
              : "-"
          }</p>
          <p><strong>Guests:</strong> ${booking.guestCount}</p>
          <p><strong>Total:</strong> INR ${Number(booking.totalAmount || 0).toLocaleString("en-IN")}</p>
          <p><strong>Advance:</strong> INR ${Number(booking.advancePaid || 0).toLocaleString("en-IN")}</p>
          <p><strong>Due:</strong> INR ${Number(booking.dueAmount || 0).toLocaleString("en-IN")}</p>
          <p><strong>Status:</strong> ${booking.status}</p>
          <hr />
          <p style="font-size: 12px;">Use browser Print -> Save as PDF for download.</p>
        </body>
      </html>
    `
    const popup = window.open("", "_blank")
    if (!popup) return
    popup.document.write(receiptHtml)
    popup.document.close()
    popup.focus()
    popup.print()
  }

  const pagedBookings = useMemo(() => {
    const start = (page - 1) * pageSize
    return bookings.slice(start, start + pageSize)
  }, [bookings, page])
  const totalPages = Math.max(1, Math.ceil(bookings.length / pageSize))

  return (
    <PermissionGuard requiredPermissions={["view_bookings"]} allowedRoles={["admin", "receptionist"]}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bookings</h1>
          <p className="text-sm text-muted-foreground">Manage reception bookings lifecycle.</p>
        </div>

        {(isAdminUser || hasPermission("create_booking")) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create Booking</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Customer</Label>
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={form.customerId}
                  onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                >
                  <option value="">Select customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} - {customer.phone}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Hall / Room</Label>
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={form.listingId}
                  onChange={(e) => setForm({ ...form, listingId: e.target.value })}
                >
                  <option value="">Select listing</option>
                  {listings.map((listing) => (
                    <option key={listing.id} value={listing.id}>
                      {listing.title} ({listing.type})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Function Date/Time</Label>
                <Input
                  type="datetime-local"
                  value={form.functionDateTime}
                  onChange={(e) => setForm({ ...form, functionDateTime: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Guest Count</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.guestCount}
                  onChange={(e) => setForm({ ...form, guestCount: Number(e.target.value || 1) })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Total Amount</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.totalAmount}
                  onChange={(e) => setForm({ ...form, totalAmount: Number(e.target.value || 0) })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Advance Amount</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.advanceAmount}
                  onChange={(e) =>
                    setForm({ ...form, advanceAmount: Number(e.target.value || 0) })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Payment Method</Label>
                <Input
                  value={form.paymentMethod}
                  onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                {conflictWarning && (
                  <p className="mb-2 text-sm text-red-600">{conflictWarning}</p>
                )}
                <Button onClick={createBooking}>Create Booking</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {(isAdminUser || hasPermission("view_bookings")) && <HallAvailabilityChecker />}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Booking List</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-3">
              <Input
                placeholder="Search bookingId, customer, phone, listing, invoice"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">All status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="checked_in">Checked-in</option>
                <option value="checked_out">Checked-out</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <Button variant="outline" onClick={() => loadBookings().catch((e) => toast.error(e.message))}>
                Apply Filters
              </Button>
            </div>

            <div className="space-y-2">
              {loadingBookings ? (
                <p className="text-sm text-muted-foreground">Loading bookings...</p>
              ) : pagedBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bookings found.</p>
              ) : (
                pagedBookings.map((booking) => (
                  <div key={booking.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {booking.listingTitle} {booking.invoiceNumber ? `(${booking.invoiceNumber})` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Status: {booking.status} | Payment: {booking.paymentStatus}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(isAdminUser || hasPermission("edit_booking")) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              doAction(booking.id, "edit", {
                                guestCount: booking.guestCount,
                                totalAmount: booking.totalAmount,
                                advancePaid: booking.advancePaid,
                              })
                            }
                          >
                            Save Edit
                          </Button>
                        )}
                        {(isAdminUser || hasPermission("cancel_booking")) &&
                          (booking.status === "pending" || booking.status === "confirmed") && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                confirmAndRun(booking.id, "cancel", {
                                  cancellationReason: "Reception cancellation",
                                })
                              }
                            >
                              Cancel booking
                            </Button>
                          )}
                        {(isAdminUser || hasPermission("check_in")) &&
                          booking.status === "confirmed" && (
                            <Button size="sm" onClick={() => confirmAndRun(booking.id, "check_in")}>
                              Check-in
                            </Button>
                          )}
                        {(isAdminUser || hasPermission("check_out")) &&
                          booking.status === "checked_in" && (
                            <Button
                              size="sm"
                              onClick={() =>
                                confirmAndRun(booking.id, "check_out", {
                                  notes: "Reception checkout",
                                })
                              }
                            >
                              Check-out
                            </Button>
                          )}
                        <Button size="sm" variant="outline" onClick={() => printReceipt(booking)}>
                          Print / PDF
                        </Button>
                        {(isAdminUser || hasPermission("send_whatsapp")) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => sendWhatsapp(booking.id, "confirmation")}
                          >
                            Send WhatsApp Confirmation
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-2 lg:grid-cols-4">
                      <p>Event date: {formatBookingDate(booking.checkInDate)}</p>
                      <p>Guests: {booking.guestCount}</p>
                      <p>Total: ₹{Number(booking.totalAmount || 0).toLocaleString("en-IN")}</p>
                      <p>Advance: ₹{Number(booking.advancePaid || 0).toLocaleString("en-IN")}</p>
                      <p>Check-in time: {formatBookingTime(booking.scheduledCheckInAt)}</p>
                      <p>Check-out time: {formatBookingTime(booking.scheduledCheckOutAt)}</p>
                      <p>Actual check-in: {formatBookingTimestamp(booking.checkInAt)}</p>
                      <p>
                        Actual check-out:{" "}
                        {booking.status === "checked_out"
                          ? formatBookingTimestamp(booking.checkOutAt) !== "-"
                            ? formatBookingTimestamp(booking.checkOutAt)
                            : "—"
                          : "-"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {bookings.length > pageSize && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    Prev
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  )
}
