"use client"

import { useEffect, useMemo, useState } from "react"
import { getAvailabilityLocks, getListings, setAvailabilityBlock } from "@/lib/firebase-db"
import { useAuth } from "@/lib/hooks/use-auth"
import type { AvailabilityLock, Listing } from "@/lib/types"
import { LISTING_TYPE_LABELS } from "@/lib/constants"
import { PermissionGuard } from "@/components/auth/permission-guard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

function formatDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

export default function ReceptionistRoomsPage() {
  const { hasPermission, isAdminUser } = useAuth()
  const canModify = isAdminUser || hasPermission("edit_booking")
  const [listings, setListings] = useState<Listing[]>([])
  const [selectedListingId, setSelectedListingId] = useState("")
  const [locks, setLocks] = useState<AvailabilityLock[]>([])
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const selectedListing = useMemo(
    () => listings.find((item) => item.id === selectedListingId) || null,
    [listings, selectedListingId]
  )

  useEffect(() => {
    getListings()
      .then((items) => {
        setListings(items)
        if (items.length > 0) setSelectedListingId(items[0].id)
      })
      .catch(() => setListings([]))
  }, [])

  async function loadLocks() {
    if (!selectedListingId) return
    const days = getDaysInMonth(year, month)
    const dates = Array.from({ length: days }).map((_, index) =>
      formatDateStr(year, month, index + 1)
    )
    const chunks: string[][] = []
    for (let idx = 0; idx < dates.length; idx += 30) {
      chunks.push(dates.slice(idx, idx + 30))
    }
    const chunkData = await Promise.all(
      chunks.map((chunk) =>
        getAvailabilityLocks(selectedListingId, chunk, selectedListing?.roomId || undefined)
      )
    )
    setLocks(chunkData.flat())
  }

  useEffect(() => {
    loadLocks().catch(() => setLocks([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedListingId, month, year])

  const lockMap = useMemo(() => {
    const map = new Map<string, AvailabilityLock>()
    locks.forEach((lock) => {
      map.set(lock.date, lock)
    })
    return map
  }, [locks])

  async function toggleDay(dateStr: string) {
    if (!selectedListing || !canModify) return
    const current = lockMap.get(dateStr)
    await setAvailabilityBlock(
      selectedListing.id,
      dateStr,
      "default",
      !Boolean(current?.isBlocked),
      selectedListing.inventory || 1
    )
    toast.success("Availability updated")
    await loadLocks()
  }

  const days = getDaysInMonth(year, month)

  return (
    <PermissionGuard requiredPermissions={["view_rooms"]} allowedRoles={["admin", "receptionist"]}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rooms / Availability</h1>
          <p className="text-sm text-muted-foreground">
            View room availability. {canModify ? "You can update blocks." : "Read-only access."}
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Availability Calendar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedListingId} onValueChange={setSelectedListingId}>
                <SelectTrigger className="w-[320px]">
                  <SelectValue placeholder="Select listing" />
                </SelectTrigger>
                <SelectContent>
                  {listings.map((listing) => (
                    <SelectItem key={listing.id} value={listing.id}>
                      {listing.title} ({LISTING_TYPE_LABELS[listing.type]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  if (month === 0) {
                    setMonth(11)
                    setYear((prev) => prev - 1)
                    return
                  }
                  setMonth((prev) => prev - 1)
                }}
              >
                Prev Month
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (month === 11) {
                    setMonth(0)
                    setYear((prev) => prev + 1)
                    return
                  }
                  setMonth((prev) => prev + 1)
                }}
              >
                Next Month
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: days }).map((_, idx) => {
                const day = idx + 1
                const dateStr = formatDateStr(year, month, day)
                const lock = lockMap.get(dateStr)
                const blocked = Boolean(lock?.isBlocked)
                const bookedUnits = Number(lock?.bookedUnits || 0)
                const maxUnits = Number(lock?.maxUnits || selectedListing?.inventory || 1)
                const isPast = new Date(`${dateStr}T00:00:00`) < new Date(new Date().toDateString())
                return (
                  <button
                    key={dateStr}
                    type="button"
                    disabled={isPast || !canModify}
                    onClick={() => toggleDay(dateStr).catch(() => toast.error("Failed to update"))}
                    className={`rounded-md border p-2 text-xs ${
                      blocked
                        ? "border-red-300 bg-red-50 text-red-700"
                        : bookedUnits > 0
                          ? "border-amber-300 bg-amber-50 text-amber-700"
                          : "border-emerald-300 bg-emerald-50 text-emerald-700"
                    } ${isPast || !canModify ? "opacity-60" : "hover:opacity-90"}`}
                    title={!canModify ? "No permission to modify room availability." : ""}
                  >
                    <div className="font-semibold">{day}</div>
                    <div>{blocked ? "Blocked" : `${bookedUnits}/${maxUnits}`}</div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  )
}
