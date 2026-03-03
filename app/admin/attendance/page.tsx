"use client"

import { useEffect, useMemo, useState } from "react"
import {
  createAuditLog,
  getAttendanceEntries,
  getRoles,
  getStaffProfiles,
  upsertAttendanceByAdmin,
} from "@/lib/firebase-db"
import type {
  AttendanceEntry,
  AttendanceStatus,
  Role,
  StaffProfile,
} from "@/lib/types"
import { Timestamp } from "firebase/firestore"
import { useAuth } from "@/lib/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

function dateToKey(input: string): string {
  return input.replaceAll("-", "")
}

function keyToDateLabel(key: string): string {
  if (key.length !== 8) return key
  return `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`
}

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

export default function AdminAttendancePage() {
  const { toast } = useToast()
  const { user, hasPermission, isAdminUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [roles, setRoles] = useState<Role[]>([])
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([])
  const [entries, setEntries] = useState<AttendanceEntry[]>([])
  const [fromDate, setFromDate] = useState(todayInput())
  const [toDate, setToDate] = useState(todayInput())
  const [staffFilter, setStaffFilter] = useState("all")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  const [markUserId, setMarkUserId] = useState("")
  const [markDate, setMarkDate] = useState(todayInput())
  const [markStatus, setMarkStatus] = useState<AttendanceStatus>("PRESENT")
  const [markNotes, setMarkNotes] = useState("")

  async function loadAll() {
    setLoading(true)
    try {
      const [roleData, staffData, attendanceData] = await Promise.all([
        getRoles(),
        getStaffProfiles(),
        getAttendanceEntries({
          dateFrom: dateToKey(fromDate),
          dateTo: dateToKey(toDate),
        }),
      ])
      setRoles(roleData)
      setStaffProfiles(staffData)
      setEntries(attendanceData)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [fromDate, toDate])

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (staffFilter !== "all" && entry.userId !== staffFilter) return false
      if (statusFilter !== "all" && entry.status !== statusFilter) return false
      if (roleFilter !== "all") {
        const staff = staffProfiles.find((profile) => profile.userId === entry.userId)
        if (!staff) return false
        const roleMatch =
          staff.roleId === roleFilter || staff.extraRoleIds?.includes(roleFilter)
        if (!roleMatch) return false
      }
      return true
    })
  }, [entries, roleFilter, staffFilter, statusFilter, staffProfiles])

  const summary = useMemo(() => {
    const relevantStaff = staffProfiles.filter((staff) => {
      if (!staff.active) return false
      if (staffFilter !== "all" && staff.userId !== staffFilter) return false
      if (roleFilter !== "all") {
        return staff.roleId === roleFilter || staff.extraRoleIds?.includes(roleFilter)
      }
      return true
    })
    const present = filteredEntries.filter((entry) => entry.status === "PRESENT").length
    const late = filteredEntries.filter((entry) => entry.status === "LATE").length
    const absent = filteredEntries.filter((entry) => entry.status === "ABSENT").length
    const total = relevantStaff.length
    const markedUsers = new Set(filteredEntries.map((entry) => entry.userId))
    const notMarked = Math.max(0, total - markedUsers.size)
    return { total, present, late, absent, notMarked }
  }, [filteredEntries, roleFilter, staffFilter, staffProfiles])

  function exportCsv() {
    const header = [
      "Date",
      "UserId",
      "RoleId",
      "Status",
      "Method",
      "CapturedAt",
      "DistanceMeters",
      "Notes",
    ]
    const lines = filteredEntries.map((entry) =>
      [
        keyToDateLabel(entry.dateKey),
        entry.userId,
        entry.roleId,
        entry.status,
        entry.method,
        entry.capturedAt?.toDate?.().toISOString?.() || "",
        entry.distanceMeters ?? "",
        (entry.notes || "").replaceAll(",", " "),
      ].join(",")
    )
    const csv = [header.join(","), ...lines].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `attendance_${dateToKey(fromDate)}_${dateToKey(toDate)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function handleAdminMark() {
    if (!isAdminUser && !hasPermission("ATTENDANCE_MARK_FOR_OTHERS")) {
      toast({
        title: "Permission denied",
        description: "You do not have permission to mark attendance for others.",
        variant: "destructive",
      })
      return
    }
    if (!markUserId) {
      toast({
        title: "Validation error",
        description: "Select a staff member first.",
        variant: "destructive",
      })
      return
    }
    const staff = staffProfiles.find((item) => item.userId === markUserId)
    if (!staff) {
      toast({
        title: "Validation error",
        description: "Staff profile not found.",
        variant: "destructive",
      })
      return
    }
    const dateKey = dateToKey(markDate)
    const attendanceId = `${markUserId}_${dateKey}_${staff.scheduleId}`
    setSaving(true)
    try {
      await upsertAttendanceByAdmin(attendanceId, {
        userId: markUserId,
        roleId: staff.roleId,
        branchId: staff.branchId,
        scheduleId: staff.scheduleId,
        workLocationId: staff.workLocationId,
        dateKey,
        status: markStatus,
        method: "ADMIN",
        geo: null,
        distanceMeters: null,
        notes: markNotes.trim(),
        createdBy: user?.uid || "",
        updatedBy: user?.uid || "",
      })
      await createAuditLog({
        entity: "attendance",
        entityId: attendanceId,
        action: "OVERRIDE",
        message: `Admin marked attendance (${markStatus})`,
        payload: { markStatus, markNotes, dateKey },
        createdBy: user?.uid || "",
      })
      toast({ title: "Attendance updated" })
      loadAll()
    } catch {
      toast({
        title: "Error",
        description: "Failed to mark attendance.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Attendance Manager</h1>
          <p className="text-sm text-muted-foreground">
            Mark, review, and export staff attendance.
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Staff</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{summary.total}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Present</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-emerald-600">
            {summary.present}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Late</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-amber-600">
            {summary.late}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Absent</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-red-600">
            {summary.absent}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Not Marked</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-muted-foreground">
            {summary.notMarked}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div className="grid gap-2">
            <Label>From</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>To</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.roleName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Staff</Label>
            <Select value={staffFilter} onValueChange={setStaffFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff</SelectItem>
                {staffProfiles.map((staff) => (
                  <SelectItem key={staff.userId} value={staff.userId}>
                    {staff.name || staff.email || staff.userId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="PRESENT">Present</SelectItem>
                <SelectItem value="LATE">Late</SelectItem>
                <SelectItem value="ABSENT">Absent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admin Mark / Override</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div className="grid gap-2 md:col-span-2">
            <Label>Staff</Label>
            <Select value={markUserId} onValueChange={setMarkUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select staff" />
              </SelectTrigger>
              <SelectContent>
                {staffProfiles.map((staff) => (
                  <SelectItem key={staff.userId} value={staff.userId}>
                    {staff.name || staff.email || staff.userId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Date</Label>
            <Input type="date" value={markDate} onChange={(e) => setMarkDate(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select
              value={markStatus}
              onValueChange={(value) => setMarkStatus(value as AttendanceStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRESENT">Present</SelectItem>
                <SelectItem value="LATE">Late</SelectItem>
                <SelectItem value="ABSENT">Absent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Note</Label>
            <Input value={markNotes} onChange={(e) => setMarkNotes(e.target.value)} />
          </div>
          <div className="md:col-span-5">
            <Button
              onClick={handleAdminMark}
              disabled={
                saving || (!isAdminUser && !hasPermission("ATTENDANCE_MARK_FOR_OTHERS"))
              }
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Attendance
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Distance</TableHead>
                  <TableHead>Captured At</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No attendance entries found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{keyToDateLabel(entry.dateKey)}</TableCell>
                      <TableCell>{entry.userId}</TableCell>
                      <TableCell>{entry.status}</TableCell>
                      <TableCell>{entry.method}</TableCell>
                      <TableCell>{entry.distanceMeters ?? "-"}</TableCell>
                      <TableCell>
                        {entry.capturedAt?.toDate?.()
                          ? entry.capturedAt.toDate().toLocaleString("en-IN")
                          : "-"}
                      </TableCell>
                      <TableCell>{entry.notes || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
