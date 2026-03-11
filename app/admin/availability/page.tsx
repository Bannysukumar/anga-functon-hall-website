"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  getListings,
  getAvailabilityLocks,
  getBookings,
  setAvailabilityBlock,
  updateListing,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  Unlock,
  Settings,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { RoomLayoutMap, type RoomVisualItem } from "@/components/rooms/room-layout-map"

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
  const router = useRouter()
  const { toast } = useToast()
  const now = new Date()
  const [listings, setListings] = useState<Listing[]>([])
  const [selectedListingId, setSelectedListingId] = useState("")
  const [locks, setLocks] = useState<AvailabilityLock[]>([])
  const [roomLocks, setRoomLocks] = useState<AvailabilityLock[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingLocks, setLoadingLocks] = useState(false)
  const [roomListings, setRoomListings] = useState<Listing[]>([])
  const [bookingsForSelectedDate, setBookingsForSelectedDate] = useState<Record<string, string>>({})
  const [selectedRoom, setSelectedRoom] = useState<Listing | null>(null)
  const [roomDialogOpen, setRoomDialogOpen] = useState(false)
  const [roomTypeDraft, setRoomTypeDraft] = useState<"ac" | "non_ac">("ac")
  const [priceDraft, setPriceDraft] = useState(0)
  const [selectedDateForRooms, setSelectedDateForRooms] = useState(
    formatDateStr(now.getFullYear(), now.getMonth(), now.getDate())
  )
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getListings()
        setListings(data)
        setRoomListings(
          data.filter((entry) =>
            ["room", "dormitory", "dining_hall", "function_hall", "open_function_hall"].includes(entry.type)
          )
        )
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

  async function loadMonthLocks(listingId: string, targetYear: number, targetMonth: number) {
    const days = getDaysInMonth(targetYear, targetMonth)
    const dates: string[] = []
    for (let d = 1; d <= days; d++) {
      dates.push(formatDateStr(targetYear, targetMonth, d))
    }

    const chunks: string[][] = []
    for (let i = 0; i < dates.length; i += 30) {
      chunks.push(dates.slice(i, i + 30))
    }

    const chunksData = await Promise.all(
      chunks.map((chunk) =>
        getAvailabilityLocks(
          listingId,
          chunk,
          selectedListing?.roomId || undefined
        )
      )
    )
    return chunksData.flat()
  }

  useEffect(() => {
    if (!selectedListingId) return
    const loadLocks = async () => {
      setLoadingLocks(true)
      try {
        const data = await loadMonthLocks(selectedListingId, year, month)
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
      const existing = map.get(lock.date)
      if (!existing) {
        map.set(lock.date, { ...lock })
        return
      }
      existing.bookedUnits = Number(existing.bookedUnits || 0) + Number(lock.bookedUnits || 0)
      existing.maxUnits = Math.max(Number(existing.maxUnits || 0), Number(lock.maxUnits || 0))
      existing.isBlocked = Boolean(existing.isBlocked || lock.isBlocked)
    })
    return map
  }, [locks])

  useEffect(() => {
    if (roomListings.length === 0 || !selectedDateForRooms) {
      setRoomLocks([])
      setBookingsForSelectedDate({})
      return
    }
    const loadRoomLocks = async () => {
      try {
        const [roomLockChunks, bookings] = await Promise.all([
          Promise.all(
          roomListings.map((room) =>
            getAvailabilityLocks(room.id, [selectedDateForRooms], room.roomId || undefined)
          )
          ),
          getBookings(),
        ])
        setRoomLocks(roomLockChunks.flat())
        const bookingMap: Record<string, string> = {}
        bookings.forEach((booking) => {
          const checkInKey = booking.checkInDate?.toDate
            ? booking.checkInDate.toDate().toISOString().slice(0, 10)
            : ""
          if (checkInKey !== selectedDateForRooms) return
          if (["cancelled", "completed", "checked_out", "no_show"].includes(booking.status)) return
          if (!bookingMap[booking.listingId]) {
            bookingMap[booking.listingId] = booking.id
          }
        })
        setBookingsForSelectedDate(bookingMap)
      } catch {
        setRoomLocks([])
        setBookingsForSelectedDate({})
      }
    }
    loadRoomLocks()
  }, [roomListings, selectedDateForRooms])

  const roomMapByListingId = useMemo(() => {
    const map = new Map<string, AvailabilityLock>()
    roomLocks.forEach((lock) => {
      if (lock.date === selectedDateForRooms && lock.slotId === "default") {
        map.set(lock.listingId, lock)
      }
    })
    return map
  }, [roomLocks, selectedDateForRooms])

  const roomVisualItems = useMemo<RoomVisualItem[]>(() => {
    return roomListings.map((room) => {
      const roomLock = roomMapByListingId.get(room.id)
      const floorFromNumber = Number.parseInt(String(room.roomNumber || "").slice(0, 1), 10)
      const floorNumber = Number(room.floorNumber || (Number.isFinite(floorFromNumber) ? floorFromNumber : 1))
      let status: RoomVisualItem["status"] =
        room.roomTypeDetail === "non_ac" ? "available_non_ac" : "available_ac"
      if (room.roomStatus === "maintenance") {
        status = "maintenance"
      } else if (room.roomStatus === "blocked") {
        status = "blocked"
      } else if (
        roomLock?.isBlocked ||
        Number(roomLock?.bookedUnits || 0) >= Number(roomLock?.maxUnits || room.inventory || 1)
      ) {
        if (room.type === "function_hall" || room.type === "open_function_hall" || room.type === "dining_hall") {
          status = "hall_booked"
        } else if (room.roomTypeDetail === "non_ac") {
          status = "booked_non_ac"
        } else {
          status = "booked_ac"
        }
      }
      return {
        id: room.id,
        roomNumber: String(room.roomNumber || room.title || room.id),
        floorNumber: Math.max(1, floorNumber),
        price: Number(room.pricePerUnit || 0),
        roomType: room.roomTypeDetail === "non_ac" ? "non_ac" : "ac",
        status,
      }
    })
  }, [roomListings, roomMapByListingId])

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
      const data = await loadMonthLocks(selectedListingId, year, month)
      setLocks(data)
    } catch {
      toast({
        title: "Error",
        description: "Failed to update availability.",
        variant: "destructive",
      })
    }
  }

  const openRoomEditor = (roomItem: RoomVisualItem) => {
    const room = roomListings.find((entry) => entry.id === roomItem.id)
    if (!room) return
    const bookingId = bookingsForSelectedDate[room.id]
    if (bookingId && roomItem.status !== "maintenance" && roomItem.status !== "blocked") {
      router.push(`/admin/bookings/${bookingId}`)
      return
    }
    setSelectedRoom(room)
    setRoomTypeDraft(room.roomTypeDetail === "non_ac" ? "non_ac" : "ac")
    setPriceDraft(Number(room.pricePerUnit || 0))
    setRoomDialogOpen(true)
  }

  const refreshData = async () => {
    if (!selectedListingId) return
    const [listingData, lockData] = await Promise.all([
      getListings(),
      loadMonthLocks(selectedListingId, year, month),
    ])
    setListings(listingData)
    setRoomListings(
      listingData.filter((entry) =>
        ["room", "dormitory", "dining_hall", "function_hall", "open_function_hall"].includes(entry.type)
      )
    )
    setLocks(lockData)
  }

  const updateRoomStatus = async (status: "available" | "blocked" | "maintenance") => {
    if (!selectedRoom) return
    try {
      await updateListing(selectedRoom.id, { roomStatus: status })
      toast({ title: `Room marked as ${status}` })
      await refreshData()
      setRoomDialogOpen(false)
    } catch {
      toast({
        title: "Error",
        description: "Failed to update room status.",
        variant: "destructive",
      })
    }
  }

  const toggleRoomBlockForSelectedDate = async (isBlocked: boolean) => {
    if (!selectedRoom) return
    try {
      await setAvailabilityBlock(selectedRoom.id, selectedDateForRooms, "default", isBlocked, selectedRoom.inventory || 1)
      toast({
        title: isBlocked ? "Room blocked for selected date" : "Room unblocked for selected date",
      })
      await refreshData()
      setRoomDialogOpen(false)
    } catch {
      toast({
        title: "Error",
        description: "Failed to update room block.",
        variant: "destructive",
      })
    }
  }

  const saveRoomMeta = async () => {
    if (!selectedRoom) return
    try {
      await updateListing(selectedRoom.id, {
        roomTypeDetail: roomTypeDraft,
        pricePerUnit: Math.max(0, Number(priceDraft || 0)),
      })
      toast({ title: "Room details updated" })
      await refreshData()
      setRoomDialogOpen(false)
    } catch {
      toast({
        title: "Error",
        description: "Failed to save room details.",
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

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4" />
              Visual Room Availability
            </CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="room-date" className="text-xs text-muted-foreground">
                Date
              </Label>
              <Input
                id="room-date"
                type="date"
                value={selectedDateForRooms}
                onChange={(event) => setSelectedDateForRooms(event.target.value)}
                className="w-[180px]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <RoomLayoutMap
            rooms={roomVisualItems}
            onToggleRoom={openRoomEditor}
            showAdminLegend
          />
        </CardContent>
      </Card>

      <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedRoom ? `Room ${selectedRoom.roomNumber || selectedRoom.title}` : "Room Controls"}
            </DialogTitle>
            <DialogDescription>
              Manage maintenance, block/unblock, room type, and price.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Room Type</Label>
                <Select
                  value={roomTypeDraft}
                  onValueChange={(value) => setRoomTypeDraft(value as "ac" | "non_ac")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ac">AC</SelectItem>
                    <SelectItem value="non_ac">Non-AC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Price</Label>
                <Input
                  type="number"
                  min={0}
                  value={priceDraft}
                  onChange={(event) => setPriceDraft(Number(event.target.value || 0))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => toggleRoomBlockForSelectedDate(true)}>
                Block Room
              </Button>
              <Button variant="outline" onClick={() => toggleRoomBlockForSelectedDate(false)}>
                Unblock Room
              </Button>
              <Button variant="outline" onClick={() => updateRoomStatus("maintenance")}>
                Mark Maintenance
              </Button>
              <Button variant="outline" onClick={() => updateRoomStatus("available")}>
                Mark Available
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveRoomMeta}>Save Room Details</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
