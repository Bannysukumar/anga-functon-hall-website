"use client"

import { useEffect, useState } from "react"
import {
  createAttendanceSchedule,
  createAuditLog,
  getAttendanceSchedules,
  getBranches,
  updateAttendanceSchedule,
} from "@/lib/firebase-db"
import type { AttendanceSchedule, Branch } from "@/lib/types"
import { useAuth } from "@/lib/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Plus, Save } from "lucide-react"
import { toast } from "sonner"

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
]

export default function AdminSchedulesPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [schedules, setSchedules] = useState<AttendanceSchedule[]>([])
  const [form, setForm] = useState({
    name: "",
    branchId: "",
    startTime: "09:00",
    endTime: "18:00",
    graceMinutes: "15",
    daysOfWeek: [1, 2, 3, 4, 5],
  })

  async function loadAll() {
    setLoading(true)
    try {
      const [branchData, scheduleData] = await Promise.all([
        getBranches(),
        getAttendanceSchedules(),
      ])
      setBranches(branchData)
      setSchedules(scheduleData)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function handleCreate() {
    if (!form.name || !form.branchId || form.daysOfWeek.length === 0) {
      toast.error("Fill all required fields.")
      return
    }
    setCreating(true)
    try {
      const id = await createAttendanceSchedule({
        name: form.name.trim(),
        branchId: form.branchId,
        daysOfWeek: form.daysOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        graceMinutes: Number(form.graceMinutes) || 0,
        active: true,
      })
      try {
        await createAuditLog({
          entity: "schedule",
          entityId: id,
          action: "CREATE",
          message: `Created schedule ${form.name}`,
          payload: form,
          createdBy: user?.uid || "",
        })
      } catch {
        // Do not fail the main action if audit logging fails.
      }
      toast.success("Schedule created")
      setDialogOpen(false)
      setForm({
        name: "",
        branchId: "",
        startTime: "09:00",
        endTime: "18:00",
        graceMinutes: "15",
        daysOfWeek: [1, 2, 3, 4, 5],
      })
      loadAll()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create schedule."
      toast.error(message)
    } finally {
      setCreating(false)
    }
  }

  async function handleSave(schedule: AttendanceSchedule) {
    setSavingId(schedule.id)
    try {
      await updateAttendanceSchedule(schedule.id, schedule)
      try {
        await createAuditLog({
          entity: "schedule",
          entityId: schedule.id,
          action: "UPDATE",
          message: `Updated schedule ${schedule.name}`,
          payload: schedule,
          createdBy: user?.uid || "",
        })
      } catch {
        // Do not fail the main action if audit logging fails.
      }
      toast.success("Schedule updated")
      loadAll()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update schedule."
      toast.error(message)
    } finally {
      setSavingId(null)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Schedules</h1>
          <p className="text-sm text-muted-foreground">
            Create shift windows used for self-attendance checks.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Schedule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Schedule</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Morning Shift"
                />
              </div>
              <div className="grid gap-2">
                <Label>Branch</Label>
                <Select
                  value={form.branchId}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, branchId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={form.startTime}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, startTime: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={form.endTime}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, endTime: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Grace Minutes (for LATE status)</Label>
                <Input
                  type="number"
                  value={form.graceMinutes}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, graceMinutes: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Allowed Days</Label>
                <div className="grid grid-cols-4 gap-2 rounded-md border p-3">
                  {DAYS.map((day) => (
                    <label key={day.value} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.daysOfWeek.includes(day.value)}
                        onCheckedChange={() => {
                          const next = form.daysOfWeek.includes(day.value)
                            ? form.daysOfWeek.filter((d) => d !== day.value)
                            : [...form.daysOfWeek, day.value]
                          setForm((prev) => ({ ...prev, daysOfWeek: next }))
                        }}
                      />
                      {day.label}
                    </label>
                  ))}
                </div>
              </div>
              <Button onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Schedule
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {schedules.map((schedule) => (
          <Card key={schedule.id}>
            <CardHeader>
              <CardTitle className="text-base">{schedule.name}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Name</Label>
                  <Input
                    value={schedule.name}
                    onChange={(e) =>
                      setSchedules((prev) =>
                        prev.map((item) =>
                          item.id === schedule.id
                            ? { ...item, name: e.target.value }
                            : item
                        )
                      )
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Grace Minutes</Label>
                  <Input
                    type="number"
                    value={schedule.graceMinutes}
                    onChange={(e) =>
                      setSchedules((prev) =>
                        prev.map((item) =>
                          item.id === schedule.id
                            ? { ...item, graceMinutes: Number(e.target.value) }
                            : item
                        )
                      )
                    }
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={schedule.startTime}
                    onChange={(e) =>
                      setSchedules((prev) =>
                        prev.map((item) =>
                          item.id === schedule.id
                            ? { ...item, startTime: e.target.value }
                            : item
                        )
                      )
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={schedule.endTime}
                    onChange={(e) =>
                      setSchedules((prev) =>
                        prev.map((item) =>
                          item.id === schedule.id
                            ? { ...item, endTime: e.target.value }
                            : item
                        )
                      )
                    }
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Allowed Days</Label>
                <div className="grid grid-cols-4 gap-2 rounded-md border p-3">
                  {DAYS.map((day) => (
                    <label key={day.value} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={schedule.daysOfWeek.includes(day.value)}
                        onCheckedChange={() =>
                          setSchedules((prev) =>
                            prev.map((item) => {
                              if (item.id !== schedule.id) return item
                              const days = item.daysOfWeek.includes(day.value)
                                ? item.daysOfWeek.filter((d) => d !== day.value)
                                : [...item.daysOfWeek, day.value]
                              return { ...item, daysOfWeek: days }
                            })
                          )
                        }
                      />
                      {day.label}
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={schedule.active}
                  onCheckedChange={(checked) =>
                    setSchedules((prev) =>
                      prev.map((item) =>
                        item.id === schedule.id
                          ? { ...item, active: Boolean(checked) }
                          : item
                      )
                    )
                  }
                />
                Schedule active
              </label>
              <Button
                className="w-fit"
                onClick={() => handleSave(schedule)}
                disabled={savingId === schedule.id}
              >
                {savingId === schedule.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
