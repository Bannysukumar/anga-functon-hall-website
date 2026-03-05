"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { addDays, endOfMonth, endOfWeek, format, isSameDay, startOfMonth, startOfWeek } from "date-fns"
import { PermissionGuard } from "@/components/auth/permission-guard"
import { useAuth } from "@/lib/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"

type CalendarEvent = {
  bookingId: string
  customerName: string
  customerPhone: string
  eventDate: string
  eventType: string
  hallName: string
  status: string
  paymentStatus: string
  remainingAmount: number
  conflict: boolean
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: "border-l-4 border-l-emerald-500 bg-emerald-50",
  pending: "border-l-4 border-l-amber-500 bg-amber-50",
  checked_in: "border-l-4 border-l-blue-500 bg-blue-50",
  completed: "border-l-4 border-l-slate-500 bg-slate-50",
  cancelled: "border-l-4 border-l-red-500 bg-red-50",
}

export default function ReceptionistCalendarPage() {
  const { user, hasPermission, isAdminUser } = useAuth()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [view, setView] = useState<"month" | "week" | "day">("month")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [status, setStatus] = useState("all")
  const [eventType, setEventType] = useState("all")
  const [selected, setSelected] = useState<CalendarEvent | null>(null)
  const [anchorDate, setAnchorDate] = useState(new Date())

  function stepDays(direction: -1 | 1) {
    if (view === "day") return 1 * direction
    if (view === "week") return 7 * direction
    return 30 * direction
  }

  async function loadCalendar() {
    if (!user) return
    try {
      const response = await fetch(
        `/api/receptionist/calendar?view=${view}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&status=${encodeURIComponent(status)}&eventType=${encodeURIComponent(eventType)}`,
        { headers: { Authorization: `Bearer ${await user.getIdToken()}` } }
      )
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to load calendar")
      setEvents(json.items || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load calendar")
    }
  }

  useEffect(() => {
    loadCalendar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, view])

  async function actionOnBooking(action: "cancel" | "check_in" | "check_out") {
    if (!user || !selected) return
    try {
      const response = await fetch(`/api/receptionist/bookings/${selected.bookingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({ action }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Action failed")
      toast.success("Booking updated")
      setSelected(null)
      loadCalendar()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed")
    }
  }

  async function sendWhatsAppConfirmation() {
    if (!user || !selected) return
    try {
      const response = await fetch(`/api/receptionist/bookings/${selected.bookingId}/whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({ kind: "confirmation" }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to send WhatsApp")
      toast.success("WhatsApp confirmation sent")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send WhatsApp")
    }
  }

  const visibleDays = useMemo(() => {
    if (view === "day") return [anchorDate]
    if (view === "week") {
      const start = startOfWeek(anchorDate, { weekStartsOn: 1 })
      return Array.from({ length: 7 }).map((_, idx) => addDays(start, idx))
    }
    const start = startOfWeek(startOfMonth(anchorDate), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(anchorDate), { weekStartsOn: 1 })
    const days: Date[] = []
    for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
      days.push(cursor)
    }
    return days
  }, [anchorDate, view])

  return (
    <PermissionGuard requiredPermissions={["view_calendar"]} allowedRoles={["admin", "receptionist"]}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Booking Calendar</h1>
          <p className="text-sm text-muted-foreground">Month/Week/Day calendar with booking actions.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-6">
            <div className="flex flex-col gap-1">
              <Label>View</Label>
              <select className="h-9 rounded-md border px-2 text-sm" value={view} onChange={(e) => setView(e.target.value as "month" | "week" | "day")}>
                <option value="month">Month</option>
                <option value="week">Week</option>
                <option value="day">Day</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Status</Label>
              <select className="h-9 rounded-md border px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="checked_in">Checked-In</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Event Type</Label>
              <Input value={eventType} onChange={(e) => setEventType(e.target.value || "all")} placeholder="all / function_hall / room" />
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={() => setAnchorDate(addDays(anchorDate, stepDays(-1)))}>
                Prev
              </Button>
              <Button variant="outline" onClick={() => setAnchorDate(addDays(anchorDate, stepDays(1)))}>
                Next
              </Button>
              <Button variant="outline" onClick={() => setAnchorDate(new Date())}>
                Today
              </Button>
              <Button onClick={loadCalendar}>Apply</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{format(anchorDate, "MMMM yyyy")}</CardTitle>
          </CardHeader>
          <CardContent className={view === "day" ? "space-y-2" : "grid gap-2 md:grid-cols-7"}>
            {visibleDays.map((day) => {
              const dayEvents = events.filter((event) => isSameDay(new Date(event.eventDate), day))
              return (
                <div key={day.toISOString()} className="rounded-md border p-2">
                  <p className="mb-2 text-xs font-medium">{format(day, "dd MMM (EEE)")}</p>
                  <div className="space-y-1">
                    {dayEvents.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">No bookings</p>
                    ) : (
                      dayEvents.map((event) => (
                        <button
                          key={event.bookingId}
                          type="button"
                          onClick={() => setSelected(event)}
                          className={`w-full rounded p-2 text-left text-xs ${STATUS_COLORS[event.status] || "border-l-4 border-l-zinc-400 bg-zinc-50"}`}
                        >
                          <p className="font-medium">{event.customerName}</p>
                          <p>{event.hallName}</p>
                          <p>{event.status}</p>
                          {event.conflict && <p className="text-red-600">Conflict: double booking</p>}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <p><span className="font-medium">Customer:</span> {selected.customerName} ({selected.customerPhone || "-"})</p>
              <p><span className="font-medium">Hall:</span> {selected.hallName}</p>
              <p><span className="font-medium">Event Date:</span> {format(new Date(selected.eventDate), "dd MMM yyyy, hh:mm a")}</p>
              <p><span className="font-medium">Event Type:</span> {selected.eventType}</p>
              <p><span className="font-medium">Booking Status:</span> {selected.status}</p>
              <p><span className="font-medium">Payment Status:</span> {selected.paymentStatus} (Remaining: INR {selected.remainingAmount.toLocaleString("en-IN")})</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/receptionist/bookings`}>View booking</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/receptionist/bookings?edit=${selected.bookingId}`}>Edit booking</Link>
                </Button>
                <Button size="sm" variant="outline" onClick={() => actionOnBooking("cancel")}>
                  Cancel booking
                </Button>
                <Button size="sm" onClick={() => actionOnBooking("check_in")}>
                  Check-in
                </Button>
                <Button size="sm" onClick={() => actionOnBooking("check_out")}>
                  Check-out
                </Button>
                {(isAdminUser || hasPermission("send_whatsapp")) && (
                  <Button size="sm" variant="outline" onClick={sendWhatsAppConfirmation}>
                    Send WhatsApp Confirmation
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PermissionGuard>
  )
}
