"use client"

import { useEffect, useMemo, useState } from "react"
import { createSelfAttendance } from "@/lib/attendance-functions"
import {
  getAttendanceEntries,
  getAttendanceSchedules,
  getWorkLocations,
} from "@/lib/firebase-db"
import { useAuth } from "@/lib/hooks/use-auth"
import type { AttendanceEntry, AttendanceSchedule, WorkLocation } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, MapPin, Clock3, ShieldAlert } from "lucide-react"
import { toast } from "sonner"

function dateKeyFromDate(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`
}

export default function MyAttendancePage() {
  const { user, staffProfile, hasPermission, refreshUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)
  const [entries, setEntries] = useState<AttendanceEntry[]>([])
  const [location, setLocation] = useState<WorkLocation | null>(null)
  const [schedule, setSchedule] = useState<AttendanceSchedule | null>(null)
  const [geoError, setGeoError] = useState("")
  const [geoInfo, setGeoInfo] = useState("")

  const todayKey = dateKeyFromDate(new Date())

  async function loadData() {
    if (!user) return
    setLoading(true)
    try {
      await refreshUser()
      const [history, schedules, locations] = await Promise.all([
        getAttendanceEntries({ userId: user.uid, limitCount: 90 }),
        getAttendanceSchedules(),
        getWorkLocations(),
      ])
      setEntries(history)
      if (staffProfile?.scheduleId) {
        setSchedule(
          schedules.find((item) => item.id === staffProfile.scheduleId) || null
        )
      }
      if (staffProfile?.workLocationId) {
        setLocation(
          locations.find((item) => item.id === staffProfile.workLocationId) || null
        )
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user, staffProfile?.scheduleId, staffProfile?.workLocationId])

  const todayEntry = entries.find((entry) => entry.dateKey === todayKey)

  const monthlySummary = useMemo(() => {
    const month = String(new Date().getMonth() + 1).padStart(2, "0")
    const year = String(new Date().getFullYear())
    const monthPrefix = `${year}${month}`
    const monthEntries = entries.filter((entry) => entry.dateKey.startsWith(monthPrefix))
    const present = monthEntries.filter((entry) => entry.status === "PRESENT").length
    const late = monthEntries.filter((entry) => entry.status === "LATE").length
    const absent = monthEntries.filter((entry) => entry.status === "ABSENT").length
    return {
      total: monthEntries.length,
      present,
      late,
      absent,
    }
  }, [entries])

  async function handleMarkAttendance() {
    if (!staffProfile) {
      toast.error("Staff profile not found.")
      return
    }
    if (!staffProfile.active) {
      toast.error("Your staff profile is inactive.")
      return
    }
    if (todayEntry) {
      toast.info("Already marked for today.")
      return
    }
    setGeoError("")
    setGeoInfo("")
    setMarking(true)
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation is not supported on this device."))
          return
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        })
      })

      setGeoInfo(
        `Location captured (accuracy: ${Math.round(position.coords.accuracy)}m)`
      )

      await createSelfAttendance({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        deviceInfo: navigator.userAgent,
      })
      toast.success("Attendance marked successfully.")
      await loadData()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to mark attendance."
      setGeoError(message)
      toast.error(message)
    } finally {
      setMarking(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!hasPermission("ATTENDANCE_SELF_MARK")) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-amber-600" />
          <p className="text-sm text-muted-foreground">
            Your role does not have attendance self-mark permission.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Attendance</h1>
        <p className="text-sm text-muted-foreground">
          Mark attendance within your assigned schedule and location.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm">
            <span className="font-medium text-foreground">Status:</span>{" "}
            {todayEntry ? (
              <Badge variant="secondary">{todayEntry.status}</Badge>
            ) : (
              <Badge variant="outline">Not marked</Badge>
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            <Clock3 className="mr-1 inline h-4 w-4" />
            {schedule
              ? `${schedule.name} (${schedule.startTime} - ${schedule.endTime})`
              : "No schedule assigned"}
          </p>
          <p className="text-sm text-muted-foreground">
            <MapPin className="mr-1 inline h-4 w-4" />
            {location
              ? `${location.name} (${location.radiusMeters}m radius)`
              : "No location assigned"}
          </p>
          <Button
            onClick={handleMarkAttendance}
            disabled={marking || !!todayEntry || !staffProfile?.active}
            className="w-full sm:w-fit"
          >
            {marking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {todayEntry ? "Already Marked" : "Mark Attendance"}
          </Button>
          {geoInfo ? <p className="text-sm text-emerald-600">{geoInfo}</p> : null}
          {geoError ? <p className="text-sm text-red-600">{geoError}</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">This Month</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{monthlySummary.total}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Present</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-emerald-600">
            {monthlySummary.present}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Late</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-amber-600">
            {monthlySummary.late}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Absent</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-red-600">
            {monthlySummary.absent}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Entries</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attendance records yet.</p>
          ) : (
            entries.slice(0, 30).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <div>
                  <p className="font-medium text-foreground">{entry.dateKey}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.capturedAt?.toDate?.()
                      ? entry.capturedAt.toDate().toLocaleString("en-IN")
                      : "-"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{entry.status}</Badge>
                  <Badge variant="outline">{entry.method}</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
