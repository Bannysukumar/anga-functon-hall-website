"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { parseFirestoreDate } from "@/lib/client/parse-firestore-date"
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

type Customer = { id: string; name: string; phone: string; email?: string }

type RoomOption = {
  roomNumber: string
  roomType: string
  floorNumber: number | null
  available: boolean
}

function formatBookingTimestamp(value: unknown): string {
  const d = parseFirestoreDate(value)
  return d ? format(d, "dd MMM yyyy hh:mm a") : "-"
}

function formatBookingTime(value: unknown): string {
  const d = parseFirestoreDate(value)
  return d ? format(d, "dd MMM hh:mm a") : "-"
}

function statusBadgeClass(status: string) {
  const s = String(status || "")
  if (s === "confirmed") return "bg-emerald-100 text-emerald-900"
  if (s === "checked_in") return "bg-green-600 text-white"
  if (s === "checked_out") return "bg-gray-200 text-gray-800"
  if (s === "cancelled") return "bg-red-100 text-red-800"
  if (s === "pending") return "bg-amber-100 text-amber-900"
  return "bg-slate-100 text-slate-800"
}

function formatBookingDate(value: unknown): string {
  const d = parseFirestoreDate(value)
  return d ? format(d, "dd MMM yyyy") : "-"
}

/** Time-based label when DB status is still `confirmed` but clock is inside scheduled window. */
function receptionistStatusBadge(booking: Booking, now: Date) {
  const s = booking.status
  if (s !== "confirmed") {
    return { text: s.replace(/_/g, " "), className: statusBadgeClass(s) }
  }
  const ci =
    parseFirestoreDate(booking.scheduledCheckInAt) ?? parseFirestoreDate(booking.checkInDate)
  const co =
    parseFirestoreDate(booking.scheduledCheckOutAt) ?? parseFirestoreDate(booking.checkOutDate)
  if (ci && co) {
    const t = now.getTime()
    if (t >= co.getTime()) {
      return {
        text: "Stay ended — needs checkout",
        className: "bg-amber-100 text-amber-900",
      }
    }
    if (t >= ci.getTime()) {
      return {
        text: "In stay (scheduled window)",
        className: "bg-sky-100 text-sky-900",
      }
    }
    return { text: "Upcoming", className: "bg-emerald-100 text-emerald-900" }
  }
  return { text: "confirmed", className: statusBadgeClass("confirmed") }
}

/** Scheduled window for action buttons (uses same fallbacks as display). */
function scheduledBounds(booking: Booking) {
  const ci =
    parseFirestoreDate(booking.scheduledCheckInAt) ?? parseFirestoreDate(booking.checkInDate)
  const co =
    parseFirestoreDate(booking.scheduledCheckOutAt) ?? parseFirestoreDate(booking.checkOutDate)
  return { ci, co }
}

/** Check-in only while stay is still active (before scheduled checkout). */
function showReceptionistCheckIn(booking: Booking, now: Date): boolean {
  if (booking.status !== "confirmed") return false
  const { co } = scheduledBounds(booking)
  if (!co) return true
  return now.getTime() < co.getTime()
}

/**
 * Check-out: normal path when checked_in, or when confirmed but scheduled checkout has passed
 * (API allows checkout from confirmed — closes stay without a recorded check-in).
 */
function showReceptionistCheckOut(booking: Booking, now: Date): boolean {
  if (booking.status === "checked_in") return true
  if (booking.status === "confirmed") {
    const { co } = scheduledBounds(booking)
    if (co && now.getTime() >= co.getTime()) return true
  }
  return false
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
    /** Non-room listings: single datetime; room listings: check-in */
    functionDateTime: "",
    checkInDateTime: "",
    checkOutDateTime: "",
    roomType: "" as "" | "ac" | "non_ac",
    floor: "" as string,
    selectedRoomNumber: "",
    guestCount: 1,
    advanceAmount: 0,
    totalAmount: 0,
    paymentMethod: "cash",
    notes: "",
  })
  const [conflictWarning, setConflictWarning] = useState("")
  const [roomOptions, setRoomOptions] = useState<RoomOption[]>([])
  const [loadingRooms, setLoadingRooms] = useState(false)

  const selectedListing = useMemo(
    () => listings.find((l) => l.id === form.listingId),
    [listings, form.listingId]
  )
  const isRoomListing = selectedListing?.type === "room"

  const floorOptions = useMemo(() => {
    const configs = selectedListing?.roomConfigurations
    if (!configs?.length) {
      const n = selectedListing?.floorNumber
      return typeof n === "number" && Number.isFinite(n) ? [n] : []
    }
    const floors = new Set<number>()
    for (const c of configs) {
      if (c.floorNumber != null && Number.isFinite(Number(c.floorNumber))) {
        floors.add(Number(c.floorNumber))
      }
    }
    return Array.from(floors).sort((a, b) => a - b)
  }, [selectedListing])

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

  /** Current time for badges + buttons (updates often so actions match clock without refresh). */
  const [listNow, setListNow] = useState(() => new Date())
  useEffect(() => {
    if (!user) return
    const id = window.setInterval(() => setListNow(new Date()), 15_000)
    return () => window.clearInterval(id)
  }, [user])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") setListNow(new Date())
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [])

  useEffect(() => {
    if (!user) return
    const id = window.setInterval(() => {
      loadBookings().catch(() => {})
    }, 15_000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    async function checkConflict() {
      const dt = isRoomListing ? form.checkInDateTime : form.functionDateTime
      if (!user || !dt || !form.listingId) {
        setConflictWarning("")
        return
      }
      try {
        const listing = listings.find((item) => item.id === form.listingId)
        if (listing?.type === "room") {
          setConflictWarning("")
          return
        }
        const hallType = listing?.type || "all"
        const response = await fetch(
          `/api/receptionist/availability?date=${encodeURIComponent(dt)}&hallType=${encodeURIComponent(hallType)}`,
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
  }, [form.functionDateTime, form.checkInDateTime, form.listingId, user, listings, isRoomListing])

  useEffect(() => {
    let cancelled = false
    async function loadRoomOptions() {
      if (!user || !isRoomListing || !form.listingId || !form.checkInDateTime || !form.checkOutDateTime) {
        setRoomOptions([])
        return
      }
      setLoadingRooms(true)
      try {
        const params = new URLSearchParams({
          listingId: form.listingId,
          checkIn: new Date(form.checkInDateTime).toISOString(),
          checkOut: new Date(form.checkOutDateTime).toISOString(),
        })
        if (form.roomType) params.set("roomType", form.roomType)
        if (form.floor !== "") params.set("floor", form.floor)
        const response = await fetch(`/api/receptionist/room-options?${params}`, {
          headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        })
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || "Failed to load rooms")
        if (!cancelled) setRoomOptions(Array.isArray(json.rooms) ? json.rooms : [])
      } catch {
        if (!cancelled) setRoomOptions([])
      } finally {
        if (!cancelled) setLoadingRooms(false)
      }
    }
    loadRoomOptions()
    return () => {
      cancelled = true
    }
  }, [
    user,
    isRoomListing,
    form.listingId,
    form.checkInDateTime,
    form.checkOutDateTime,
    form.roomType,
    form.floor,
  ])

  async function createBooking() {
    if (!user) return
    if (isRoomListing) {
      if (!form.checkInDateTime || !form.checkOutDateTime) {
        toast.error("Check-in and check-out date/time are required.")
        return
      }
      if (!form.selectedRoomNumber) {
        toast.error("Select an available room number.")
        return
      }
      const sel = roomOptions.find((r) => r.roomNumber === form.selectedRoomNumber)
      if (sel && !sel.available) {
        toast.error("Selected room is not available for this time range.")
        return
      }
    } else if (!form.functionDateTime) {
      toast.error("Function date/time is required.")
      return
    }
    if (!form.listingId?.trim()) {
      toast.error("Select a listing.")
      return
    }
    if (!form.totalAmount || form.totalAmount <= 0) {
      toast.error("Enter a total amount greater than zero.")
      return
    }
    if (!String(form.paymentMethod || "").trim() || String(form.paymentMethod).trim().length < 2) {
      toast.error("Select a payment method.")
      return
    }
    try {
      const payload: Record<string, unknown> = {
        customerId: form.customerId,
        listingId: form.listingId,
        guestCount: form.guestCount,
        advanceAmount: form.advanceAmount,
        totalAmount: form.totalAmount,
        paymentMethod: form.paymentMethod,
        notes: form.notes,
      }
      if (isRoomListing) {
        payload.functionDateTime = form.checkInDateTime
        payload.checkOutDateTime = form.checkOutDateTime
        if (form.roomType) payload.roomType = form.roomType
        if (form.floor !== "") payload.floor = Number(form.floor)
        payload.selectedRoomNumber = form.selectedRoomNumber
      } else {
        payload.functionDateTime = form.functionDateTime
        if (form.checkOutDateTime) payload.checkOutDateTime = form.checkOutDateTime
      }
      const response = await fetch("/api/receptionist/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify(payload),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to create booking")
      toast.success(`Booking created (${json.invoiceNumber})`)
      setForm({
        customerId: "",
        listingId: "",
        functionDateTime: "",
        checkInDateTime: "",
        checkOutDateTime: "",
        roomType: "",
        floor: "",
        selectedRoomNumber: "",
        guestCount: 1,
        advanceAmount: 0,
        totalAmount: 0,
        paymentMethod: "cash",
        notes: "",
      })
      setRoomOptions([])
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
            (() => {
              const d =
                parseFirestoreDate(booking.checkInDate) ??
                parseFirestoreDate(booking.scheduledCheckInAt)
              return d ? format(d, "dd MMM yyyy, hh:mm a") : "-"
            })()
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
                      {customer.email ? ` (${customer.email})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Hall / Room listing</Label>
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={form.listingId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      listingId: e.target.value,
                      roomType: "",
                      floor: "",
                      selectedRoomNumber: "",
                      checkInDateTime: "",
                      checkOutDateTime: "",
                    })
                  }
                >
                  <option value="">Select listing</option>
                  {listings.map((listing) => (
                    <option key={listing.id} value={listing.id}>
                      {listing.title} ({listing.type})
                    </option>
                  ))}
                </select>
              </div>
              {isRoomListing ? (
                <>
                  <div className="flex flex-col gap-2">
                    <Label>Room type</Label>
                    <select
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                      value={form.roomType}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          roomType: e.target.value as "" | "ac" | "non_ac",
                          selectedRoomNumber: "",
                        })
                      }
                    >
                      <option value="">Any / select</option>
                      <option value="ac">AC</option>
                      <option value="non_ac">Non-AC</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Floor</Label>
                    <select
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                      value={form.floor}
                      onChange={(e) =>
                        setForm({ ...form, floor: e.target.value, selectedRoomNumber: "" })
                      }
                    >
                      <option value="">Any</option>
                      {floorOptions.map((f) => (
                        <option key={f} value={String(f)}>
                          {f === 1 ? "1st" : f === 2 ? "2nd" : f === 3 ? "3rd" : `${f}th`} floor
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <Label>Check-in date &amp; time</Label>
                    <Input
                      type="datetime-local"
                      value={form.checkInDateTime}
                      onChange={(e) => setForm({ ...form, checkInDateTime: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <Label>Check-out date &amp; time</Label>
                    <Input
                      type="datetime-local"
                      value={form.checkOutDateTime}
                      onChange={(e) => setForm({ ...form, checkOutDateTime: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <Label>Room number</Label>
                    <select
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                      value={form.selectedRoomNumber}
                      onChange={(e) => setForm({ ...form, selectedRoomNumber: e.target.value })}
                      disabled={loadingRooms || !form.checkInDateTime || !form.checkOutDateTime}
                    >
                      <option value="">
                        {loadingRooms ? "Loading rooms…" : "Select room (available only)"}
                      </option>
                      {roomOptions.map((r) => (
                        <option key={r.roomNumber} value={r.roomNumber} disabled={!r.available}>
                          {r.roomNumber} — {r.roomType === "non_ac" ? "Non-AC" : "AC"}
                          {r.floorNumber != null ? ` — Fl ${r.floorNumber}` : ""}{" "}
                          {r.available ? "" : "(booked)"}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Choose room type and floor to narrow the list. Only non-overlapping slots are
                      selectable.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <Label>Function date / time</Label>
                    <Input
                      type="datetime-local"
                      value={form.functionDateTime}
                      onChange={(e) => setForm({ ...form, functionDateTime: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <Label>Check-out (optional)</Label>
                    <Input
                      type="datetime-local"
                      value={form.checkOutDateTime}
                      onChange={(e) => setForm({ ...form, checkOutDateTime: e.target.value })}
                    />
                  </div>
                </>
              )}
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
                placeholder="Search bookingId, customer, phone, email, listing, invoice"
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
                pagedBookings.map((booking) => {
                  const statusBadge = receptionistStatusBadge(booking, listNow)
                  return (
                  <div key={booking.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {booking.listingTitle} {booking.invoiceNumber ? `(${booking.invoiceNumber})` : ""}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className={`rounded-full px-2 py-0.5 font-medium ${statusBadge.className}`}
                          >
                            {statusBadge.text}
                          </span>
                          <span className="text-muted-foreground">
                            Payment: {booking.paymentStatus}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Room:{" "}
                          {(booking.selectedRoomNumbers && booking.selectedRoomNumbers[0]) ||
                            booking.roomNumber ||
                            "—"}{" "}
                          | Type:{" "}
                          {booking.roomTypeDetail === "non_ac" ? "Non-AC" : "AC"}
                          {booking.roomFloorLabel ? ` | ${booking.roomFloorLabel}` : ""}
                        </p>
                        {(booking.customerEmail || booking.customerPhone) && (
                          <p className="text-xs text-muted-foreground">
                            {booking.customerEmail || "—"} · {booking.customerPhone || "—"}
                          </p>
                        )}
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
                          showReceptionistCheckIn(booking, listNow) && (
                            <Button size="sm" onClick={() => confirmAndRun(booking.id, "check_in")}>
                              Check-in
                            </Button>
                          )}
                        {(isAdminUser || hasPermission("check_out")) &&
                          showReceptionistCheckOut(booking, listNow) && (
                            <Button
                              size="sm"
                              onClick={() =>
                                confirmAndRun(booking.id, "check_out", {
                                  notes: "Reception checkout",
                                })
                              }
                            >
                              {booking.status === "confirmed" ? "Complete checkout" : "Check-out"}
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
                      <p>
                        Event date:{" "}
                        {formatBookingDate(booking.checkInDate ?? booking.scheduledCheckInAt)}
                      </p>
                      <p>Guests: {booking.guestCount}</p>
                      <p>Total: ₹{Number(booking.totalAmount || 0).toLocaleString("en-IN")}</p>
                      <p>Advance: ₹{Number(booking.advancePaid || 0).toLocaleString("en-IN")}</p>
                      <p>
                        Check-in time:{" "}
                        {formatBookingTime(booking.scheduledCheckInAt ?? booking.checkInDate)}
                      </p>
                      <p>
                        Check-out time:{" "}
                        {formatBookingTime(booking.scheduledCheckOutAt ?? booking.checkOutDate)}
                      </p>
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
                  )
                })
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
