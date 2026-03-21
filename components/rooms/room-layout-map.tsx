"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { BedDouble } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type RoomVisualStatus =
  | "available_ac"
  | "available_non_ac"
  | "booked_ac"
  | "booked_non_ac"
  | "hall_booked"
  | "booked"
  | "maintenance"
  | "blocked"
  | "selected"

export interface RoomVisualItem {
  id: string
  roomNumber: string
  floorNumber: number
  price: number
  roomType: "ac" | "non_ac"
  status: RoomVisualStatus
  disabled?: boolean
  /** Optional tooltip when status is booked (time-based overlap). */
  bookedUntilLabel?: string
}

interface RoomLayoutMapProps {
  rooms: RoomVisualItem[]
  selectedRoomIds?: string[]
  onToggleRoom?: (room: RoomVisualItem) => void
  showAdminLegend?: boolean
}

const LOAD_STEP = 48

function floorLabel(floor: number) {
  if (floor === 1) return "1st Floor"
  if (floor === 2) return "2nd Floor"
  if (floor === 3) return "3rd Floor"
  return `${floor}th Floor`
}

function isBookedStatus(status: RoomVisualStatus) {
  return (
    status === "booked" ||
    status === "booked_ac" ||
    status === "booked_non_ac" ||
    status === "hall_booked"
  )
}

function cardClasses(status: RoomVisualStatus, disabled = false) {
  if (disabled || status === "booked") {
    return "border-red-500 bg-red-50 text-red-800 cursor-not-allowed opacity-95"
  }
  if (status === "booked_ac") {
    return "border-red-400 bg-red-50 text-red-700 cursor-not-allowed"
  }
  if (status === "booked_non_ac") {
    return "border-red-400 bg-red-50 text-red-700 cursor-not-allowed"
  }
  if (status === "hall_booked") {
    return "border-purple-400 bg-purple-50 text-purple-700 cursor-not-allowed"
  }
  if (status === "maintenance") {
    return "border-red-300 bg-red-50 text-red-700"
  }
  if (status === "blocked") {
    return "border-orange-300 bg-orange-50 text-orange-700"
  }
  if (status === "selected") {
    return "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700 shadow-[0_0_0_2px_rgba(217,70,239,0.15)]"
  }
  if (status === "available_ac") {
    return "border-emerald-400 bg-emerald-50 text-emerald-700"
  }
  return "border-amber-400 bg-amber-50 text-amber-800"
}

export function RoomLayoutMap({
  rooms,
  selectedRoomIds = [],
  onToggleRoom,
  showAdminLegend = false,
}: RoomLayoutMapProps) {
  const groupedByFloor = useMemo(() => {
    const map = new Map<number, RoomVisualItem[]>()
    rooms.forEach((room) => {
      const floor = Math.max(1, Number(room.floorNumber || 1))
      const existing = map.get(floor) || []
      existing.push(room)
      map.set(floor, existing)
    })
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([floor, floorRooms]) => ({
        floor,
        rooms: floorRooms.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true })),
      }))
  }, [rooms])

  const defaultFloor = groupedByFloor[0]?.floor ? String(groupedByFloor[0].floor) : "1"
  const [activeFloor, setActiveFloor] = useState(defaultFloor)
  const [visibleCount, setVisibleCount] = useState(LOAD_STEP)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setActiveFloor(defaultFloor)
    setVisibleCount(LOAD_STEP)
  }, [defaultFloor, rooms])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleCount((prev) => prev + LOAD_STEP)
          }
        })
      },
      { rootMargin: "300px" }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  if (groupedByFloor.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No rooms found.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" className="border-emerald-400 text-emerald-700">
          Available AC
        </Badge>
        <Badge variant="outline" className="border-amber-400 text-amber-800">
          Available Non-AC
        </Badge>
        <Badge variant="outline" className="border-red-400 text-red-700">
          Booked
        </Badge>
        <Badge variant="outline" className="border-fuchsia-400 text-fuchsia-700">
          Selected
        </Badge>
        {showAdminLegend ? (
          <>
            <Badge variant="outline" className="border-red-400 text-red-700">
              Booked AC
            </Badge>
            <Badge variant="outline" className="border-orange-400 text-orange-700">
              Booked Non-AC
            </Badge>
            <Badge variant="outline" className="border-purple-400 text-purple-700">
              Hall Booked
            </Badge>
            <Badge variant="outline" className="border-red-300 text-red-700">
              Maintenance
            </Badge>
            <Badge variant="outline" className="border-orange-300 text-orange-700">
              Blocked
            </Badge>
          </>
        ) : null}
      </div>

      <Tabs value={activeFloor} onValueChange={setActiveFloor}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {groupedByFloor.map(({ floor }) => (
            <TabsTrigger key={floor} value={String(floor)} className="shrink-0">
              {floorLabel(floor)}
            </TabsTrigger>
          ))}
        </TabsList>

        {groupedByFloor.map(({ floor, rooms: floorRooms }) => {
          const visibleRooms = floorRooms.slice(0, visibleCount)
          return (
            <TabsContent key={floor} value={String(floor)} className="pt-2">
              <div className="rounded-xl border bg-muted/20 p-3 sm:p-4">
                <p className="mb-3 text-xs font-medium text-muted-foreground">
                  Top View - {floorLabel(floor)}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                  {visibleRooms.map((room) => {
                    const selected = selectedRoomIds.includes(room.id)
                    const status = selected ? "selected" : room.status
                    const disabled =
                      room.disabled ||
                      isBookedStatus(room.status) ||
                      room.status === "maintenance" ||
                      room.status === "blocked"
                    const bookedLabel =
                      disabled && isBookedStatus(room.status)
                        ? room.bookedUntilLabel
                          ? `Already booked — ${room.bookedUntilLabel}`
                          : "Already booked for these dates"
                        : undefined
                    return (
                      <button
                        key={room.id}
                        type="button"
                        disabled={disabled}
                        title={bookedLabel}
                        onClick={() => onToggleRoom?.(room)}
                        className={cn(
                          "w-full aspect-square rounded-lg border p-2 transition-all duration-150",
                          "flex flex-col items-center justify-center text-center",
                          !disabled &&
                            "hover:scale-[1.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                          cardClasses(status, disabled)
                        )}
                      >
                        <BedDouble className="mb-1 h-4 w-4" />
                        <span className="text-xs font-semibold leading-tight">
                          {disabled && isBookedStatus(room.status)
                            ? "Booked"
                            : disabled
                              ? "Unavailable"
                              : `Room ${room.roomNumber}`}
                        </span>
                        <p className="mt-1 text-xs font-semibold">{`₹${Math.round(room.price).toLocaleString("en-IN")}`}</p>
                        <p className="text-[10px] uppercase tracking-wide opacity-90">
                          {room.roomType === "ac" ? "AC" : "Non-AC"}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div ref={sentinelRef} className="h-4 w-full" />
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
