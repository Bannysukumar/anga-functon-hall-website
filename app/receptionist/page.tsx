"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/hooks/use-auth"
import { toast } from "sonner"
import { HallAvailabilityChecker } from "@/components/receptionist/hall-availability-checker"

type ReminderItem = {
  bookingId: string
  customerName: string
  customerPhone: string
  eventDate: string
  remainingAmount: number
  daysBeforeEvent: number
}

export default function ReceptionistHomePage() {
  const { hasPermission, isAdminUser, user } = useAuth()
  const [todaySummary, setTodaySummary] = useState<{
    checkIns: number
    checkOuts: number
    upcoming: number
    cancelled: number
  } | null>(null)
  const [reminders, setReminders] = useState<ReminderItem[]>([])
  const [remindersEnabled, setRemindersEnabled] = useState(true)

  useEffect(() => {
    async function loadSummary() {
      if (!user) return
      try {
        const res = await fetch(
          "/api/receptionist/bookings?limit=300",
          { headers: { Authorization: `Bearer ${await user.getIdToken()}` } }
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to load")
        const items = Array.isArray(data.items) ? data.items : []
        setTodaySummary({
          checkIns: items.filter((b: { status?: string }) => b.status === "checked_in").length,
          checkOuts: items.filter((b: { status?: string }) => b.status === "checked_out").length,
          upcoming: items.filter((b: { status?: string }) => b.status === "confirmed").length,
          cancelled: items.filter((b: { status?: string }) => b.status === "cancelled").length,
        })
      } catch {
        setTodaySummary({ checkIns: 0, checkOuts: 0, upcoming: 0, cancelled: 0 })
      }
    }
    if (isAdminUser || hasPermission("view_bookings")) {
      loadSummary()
    } else {
      setTodaySummary({ checkIns: 0, checkOuts: 0, upcoming: 0, cancelled: 0 })
    }
  }, [user, hasPermission, isAdminUser])

  useEffect(() => {
    async function loadReminders() {
      if (!user) return
      try {
        const response = await fetch("/api/receptionist/reminders", {
          headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        })
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || "Failed to load reminders")
        setReminders(json.items || [])
        setRemindersEnabled(json.enabled !== false)
      } catch {
        setReminders([])
      }
    }
    if (isAdminUser || hasPermission("manage_payment_reminders")) {
      loadReminders()
    }
  }, [user, hasPermission, isAdminUser])

  async function sendReminder(bookingId: string) {
    if (!user) return
    try {
      const response = await fetch(`/api/receptionist/bookings/${bookingId}/whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({ kind: "reminder" }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to send reminder")
      toast.success("WhatsApp reminder sent")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send reminder")
    }
  }

  async function markPaid(bookingId: string) {
    if (!user) return
    try {
      const response = await fetch(`/api/receptionist/bookings/${bookingId}/payment`, {
        method: "POST",
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to mark paid")
      setReminders((prev) => prev.filter((item) => item.bookingId !== bookingId))
      toast.success("Booking marked paid")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to mark paid")
    }
  }

  const summary = todaySummary ?? {
    checkIns: 0,
    checkOuts: 0,
    upcoming: 0,
    cancelled: 0,
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Receptionist Dashboard</h1>
        <p className="text-sm text-muted-foreground">Today’s operational summary and quick actions.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {([
          ["checkIns", "Check-ins", summary.checkIns],
          ["checkOuts", "Check-outs", summary.checkOuts],
          ["upcoming", "Upcoming", summary.upcoming],
          ["cancelled", "Cancelled", summary.cancelled],
        ] as const).map(([key, label, value]) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="text-base">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{todaySummary === null ? "…" : value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(isAdminUser || hasPermission("create_booking")) && (
            <Button asChild>
              <Link href="/receptionist/bookings">Create Booking</Link>
            </Button>
          )}
          {(isAdminUser || hasPermission("view_bookings")) && (
            <Button asChild variant="outline">
              <Link href="/receptionist/bookings">Search Booking</Link>
            </Button>
          )}
          {(isAdminUser || hasPermission("create_customer")) && (
            <Button asChild variant="outline">
              <Link href="/receptionist/customers">Add Customer</Link>
            </Button>
          )}
          {(isAdminUser || hasPermission("view_calendar")) && (
            <Button asChild variant="outline">
              <Link href="/receptionist/calendar">Open Calendar</Link>
            </Button>
          )}
          {(isAdminUser || hasPermission("manage_visitors")) && (
            <Button asChild variant="outline">
              <Link href="/receptionist/visitors">Visitor Leads</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {(isAdminUser || hasPermission("view_bookings")) && <HallAvailabilityChecker />}

      {(isAdminUser || hasPermission("manage_payment_reminders")) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Reminders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!remindersEnabled ? (
              <p className="text-sm text-muted-foreground">Payment reminders are disabled by admin.</p>
            ) : reminders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending reminder for 7/3/1-day windows.</p>
            ) : (
              reminders.map((item) => (
                <div key={item.bookingId} className="rounded-md border p-3">
                  <p className="font-medium">
                    {item.customerName} - {item.eventDate}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Remaining Amount: INR {Number(item.remainingAmount || 0).toLocaleString("en-IN")} | D-{item.daysBeforeEvent}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => sendReminder(item.bookingId)}>
                      Send WhatsApp Reminder
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={`tel:${item.customerPhone}`}>Call Customer</a>
                    </Button>
                    <Button size="sm" onClick={() => markPaid(item.bookingId)}>
                      Mark Paid
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
