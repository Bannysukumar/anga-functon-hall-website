"use client"

import { useState, useEffect, useMemo } from "react"
import {
  getListings,
  getAvailabilityLocks,
  setAvailabilityBlock,
} from "@/lib/firebase-db"
import type { Listing, AvailabilityLock } from "@/lib/types"
import { LISTING_TYPE_LABELS } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  Unlock,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function formatDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export default function AdminAvailabilityPage() {
  const { toast } = useToast()
  const [listings, setListings] = useState<Listing[]>([])
  const [selectedListingId, setSelectedListingId] = useState("")
  const [locks, setLocks] = useState<AvailabilityLock[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingLocks, setLoadingLocks] = useState(false)

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getListings()
        setListings(data)
        if (data.length > 0) setSelectedListingId(data[0].id)
      } catch (err) {
        console.error("Error loading listings:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const selectedListing = useMemo(
    () => listings.find((l) => l.id === selectedListingId),
    [listings, selectedListingId]
  )

  useEffect(() => {
    if (!selectedListingId) return
    const loadLocks = async () => {
      setLoadingLocks(true)
      try {
        const daysInMonth = getDaysInMonth(year, month)
        const dates: string[] = []
        for (let d = 1; d <= daysInMonth; d++) {
          dates.push(formatDateStr(year, month, d))
        }
        // Load in batches of 30 (Firestore "in" limit)
        const batch1 = dates.slice(0, 30)
        const data = await getAvailabilityLocks(selectedListingId, batch1)
        setLocks(data)
      } catch (err) {
        console.error("Error loading locks:", err)
      } finally {
        setLoadingLocks(false)
      }
    }
    loadLocks()
  }, [selectedListingId, year, month])

  const lockMap = useMemo(() => {
    const map = new Map<string, AvailabilityLock>()
    locks.forEach((lock) => {
      map.set(lock.date, lock)
    })
    return map
  }, [locks])

  const handleToggleBlock = async (dateStr: string) => {
    if (!selectedListing) return
    const existing = lockMap.get(dateStr)
    const isCurrentlyBlocked = existing?.isBlocked || false
    try {
      await setAvailabilityBlock(
        selectedListing.id,
        dateStr,
        "default",
        !isCurrentlyBlocked,
        selectedListing.inventory || 1
      )
      toast({
        title: isCurrentlyBlocked
          ? "Date unblocked"
          : "Date blocked",
      })
      // Reload locks
      const daysInMonth = getDaysInMonth(year, month)
      const dates: string[] = []
      for (let d = 1; d <= daysInMonth; d++) {
        dates.push(formatDateStr(year, month, d))
      }
      const batch1 = dates.slice(0, 30)
      const data = await getAvailabilityLocks(selectedListingId, batch1)
      setLocks(data)
    } catch {
      toast({
        title: "Error",
        description: "Failed to update availability.",
        variant: "destructive",
      })
    }
  }

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11)
      setYear(year - 1)
    } else {
      setMonth(month - 1)
    }
  }

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0)
      setYear(year + 1)
    } else {
      setMonth(month + 1)
    }
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

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
        <h1 className="text-2xl font-bold text-foreground">
          Availability Management
        </h1>
        <p className="text-sm text-muted-foreground">
          Block/unblock dates and view booked units per listing
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" />
              Calendar
            </CardTitle>
            <Select
              value={selectedListingId}
              onValueChange={setSelectedListingId}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select a listing" />
              </SelectTrigger>
              <SelectContent>
                {listings.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.title} ({LISTING_TYPE_LABELS[l.type]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {/* Month Navigation */}
          <div className="mb-6 flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-semibold text-foreground">
              {MONTH_NAMES[month]} {year}
            </h3>
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Legend */}
          <div className="mb-4 flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-emerald-200" />
              <span className="text-muted-foreground">Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-amber-200" />
              <span className="text-muted-foreground">Partially Booked</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-red-200" />
              <span className="text-muted-foreground">Fully Booked / Blocked</span>
            </div>
          </div>

          {loadingLocks ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {/* Day headers */}
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div
                  key={d}
                  className="py-2 text-center text-xs font-medium text-muted-foreground"
                >
                  {d}
                </div>
              ))}

              {/* Empty cells before first day */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}

              {/* Calendar days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dateStr = formatDateStr(year, month, day)
                const lock = lockMap.get(dateStr)
                const isBlocked = lock?.isBlocked || false
                const bookedUnits = lock?.bookedUnits || 0
                const maxUnits = selectedListing?.inventory || 1
                const isFull = bookedUnits >= maxUnits
                const isPartial = bookedUnits > 0 && !isFull

                const isPast = new Date(dateStr) < new Date(new Date().toDateString())

                return (
                  <button
                    key={day}
                    className={cn(
                      "relative flex flex-col items-center justify-center rounded-lg border p-2 text-sm transition-colors",
                      isPast && "opacity-50",
                      isBlocked
                        ? "border-red-300 bg-red-100 text-red-800"
                        : isFull
                          ? "border-red-300 bg-red-50 text-red-700"
                          : isPartial
                            ? "border-amber-300 bg-amber-50 text-amber-700"
                            : "border-border bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    )}
                    onClick={() => !isPast && handleToggleBlock(dateStr)}
                    disabled={isPast}
                  >
                    <span className="font-medium">{day}</span>
                    {(isBlocked || bookedUnits > 0) && (
                      <span className="mt-0.5 text-[10px]">
                        {isBlocked ? (
                          <Lock className="inline h-3 w-3" />
                        ) : (
                          `${bookedUnits}/${maxUnits}`
                        )}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {selectedListing && (
            <div className="mt-6 rounded-lg border bg-secondary/50 p-4">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{selectedListing.title}</strong> has{" "}
                <strong className="text-foreground">{selectedListing.inventory || 1}</strong> unit(s) available.
                Click a day to toggle its blocked status.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
