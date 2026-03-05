"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useAuth } from "@/lib/hooks/use-auth"
import type { ListingType } from "@/lib/types"
import { LISTING_TYPE_LABELS, LISTING_TYPES } from "@/lib/constants"

type AvailabilityResponse = {
  date: string
  status: "AVAILABLE" | "BOOKED"
  booked: null | {
    customerName: string
    eventType: string
    bookingStatus: string
    bookingId: string
  }
  nextAvailableDates: string[]
}

export function HallAvailabilityChecker() {
  const { user } = useAuth()
  const [date, setDate] = useState("")
  const [hallType, setHallType] = useState<string>("all")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AvailabilityResponse | null>(null)

  async function checkAvailability() {
    if (!user) return
    if (!date) {
      toast.error("Please select event date.")
      return
    }
    setLoading(true)
    try {
      const response = await fetch(
        `/api/receptionist/availability?date=${encodeURIComponent(date)}&hallType=${encodeURIComponent(hallType)}`,
        { headers: { Authorization: `Bearer ${await user.getIdToken()}` } }
      )
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to check availability")
      setResult(json)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to check availability")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Check Hall Availability</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label>Event Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Hall Type</Label>
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={hallType}
              onChange={(e) => setHallType(e.target.value)}
            >
              <option value="all">All</option>
              {LISTING_TYPES.map((type) => (
                <option key={type} value={type}>
                  {LISTING_TYPE_LABELS[type as ListingType]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={checkAvailability} disabled={loading}>
              {loading ? "Checking..." : "Check"}
            </Button>
          </div>
        </div>
        {result && (
          <div className="rounded-md border p-3 text-sm">
            <p>
              <span className="font-medium">Date:</span> {result.date}
            </p>
            <p className={result.status === "BOOKED" ? "text-red-600" : "text-emerald-600"}>
              <span className="font-medium">Status:</span> {result.status}
            </p>
            {result.booked && (
              <p className="text-muted-foreground">
                {result.booked.customerName} | {result.booked.eventType} | {result.booked.bookingStatus}
              </p>
            )}
            {result.nextAvailableDates.length > 0 && (
              <p className="mt-1 text-muted-foreground">
                Next Available Dates: {result.nextAvailableDates.join(", ")}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
