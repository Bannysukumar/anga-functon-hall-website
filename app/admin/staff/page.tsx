"use client"

import { useEffect, useMemo, useState } from "react"
import {
  createAuditLog,
  getAllUsers,
  getAttendanceSchedules,
  getBranches,
  getRoles,
  getStaffProfiles,
  getWorkLocations,
  upsertStaffProfile,
} from "@/lib/firebase-db"
import type {
  AppUser,
  AttendanceSchedule,
  Branch,
  Permission,
  Role,
  StaffProfile,
  WorkLocation,
} from "@/lib/types"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"

type StaffDraft = {
  roleId: string
  extraRoleIds: string[]
  branchId: string
  workLocationId: string
  scheduleId: string
  active: boolean
}

export default function AdminStaffPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const [users, setUsers] = useState<AppUser[]>([])
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [locations, setLocations] = useState<WorkLocation[]>([])
  const [schedules, setSchedules] = useState<AttendanceSchedule[]>([])
  const [drafts, setDrafts] = useState<Record<string, StaffDraft>>({})

  async function loadAll() {
    setLoading(true)
    try {
      const [u, s, r, b, l, sch] = await Promise.all([
        getAllUsers(),
        getStaffProfiles(),
        getRoles(),
        getBranches(),
        getWorkLocations(),
        getAttendanceSchedules(),
      ])
      setUsers(u)
      setStaffProfiles(s)
      setRoles(r)
      setBranches(b)
      setLocations(l)
      setSchedules(sch)
      const nextDrafts: Record<string, StaffDraft> = {}
      u.forEach((userItem) => {
        const staff = s.find((item) => item.userId === userItem.id)
        nextDrafts[userItem.id] = {
          roleId: staff?.roleId || "",
          extraRoleIds: staff?.extraRoleIds || [],
          branchId: staff?.branchId || "",
          workLocationId: staff?.workLocationId || "",
          scheduleId: staff?.scheduleId || "",
          active: staff?.active ?? false,
        }
      })
      setDrafts(nextDrafts)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        u.displayName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q)
    )
  }, [users, search])

  function updateDraft(userId: string, patch: Partial<StaffDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], ...patch },
    }))
  }

  async function saveStaff(userItem: AppUser) {
    const draft = drafts[userItem.id]
    if (!draft?.roleId || !draft.branchId || !draft.workLocationId || !draft.scheduleId) {
      toast.error("Role, branch, location, and schedule are required.")
      return
    }
    setSavingUserId(userItem.id)
    try {
      const roleMap = new Map(roles.map((role) => [role.id, role]))
      const allRoleIds = [draft.roleId, ...draft.extraRoleIds]
      const effectivePermissions = Array.from(
        new Set(
          allRoleIds.flatMap(
            (roleId) => (roleMap.get(roleId)?.permissions || []) as Permission[]
          )
        )
      )
      await upsertStaffProfile(userItem.id, {
        name: userItem.displayName || "",
        phone: userItem.phone || "",
        email: userItem.email || "",
        roleId: draft.roleId,
        extraRoleIds: draft.extraRoleIds,
        effectivePermissions,
        branchId: draft.branchId,
        workLocationId: draft.workLocationId,
        scheduleId: draft.scheduleId,
        active: draft.active,
      })
      try {
        await createAuditLog({
          entity: "staff",
          entityId: userItem.id,
          action: "ASSIGN_ROLE",
          message: `Updated staff assignment for ${userItem.email}`,
          payload: draft,
          createdBy: user?.uid || "",
        })
      } catch {
        // Do not fail the main save action if audit logging fails.
      }
      toast.success("Staff assignment saved")
      loadAll()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save staff assignment."
      toast.error(message)
    } finally {
      setSavingUserId(null)
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
      <div>
        <h1 className="text-2xl font-bold text-foreground">Staff Manager</h1>
        <p className="text-sm text-muted-foreground">
          Assign role, location, and schedule for attendance control.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="max-w-sm">
            <Label htmlFor="search">Search user</Label>
            <Input
              id="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name/email/phone"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {filteredUsers.map((userItem) => {
          const draft = drafts[userItem.id]
          if (!draft) return null
          const branchLocations = locations.filter(
            (loc) => !draft.branchId || loc.branchId === draft.branchId
          )
          const branchSchedules = schedules.filter(
            (schedule) => !draft.branchId || schedule.branchId === draft.branchId
          )

          return (
            <Card key={userItem.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{userItem.displayName || "User"}</span>
                  <Badge variant={draft.active ? "default" : "secondary"}>
                    {draft.active ? "Active staff" : "Inactive"}
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">{userItem.email}</p>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Primary Role</Label>
                    <Select
                      value={draft.roleId}
                      onValueChange={(value) => updateDraft(userItem.id, { roleId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.roleName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Branch</Label>
                    <Select
                      value={draft.branchId}
                      onValueChange={(value) =>
                        updateDraft(userItem.id, {
                          branchId: value,
                          workLocationId: "",
                          scheduleId: "",
                        })
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
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Work Location</Label>
                    <Select
                      value={draft.workLocationId}
                      onValueChange={(value) =>
                        updateDraft(userItem.id, { workLocationId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        {branchLocations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Schedule</Label>
                    <Select
                      value={draft.scheduleId}
                      onValueChange={(value) => updateDraft(userItem.id, { scheduleId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select schedule" />
                      </SelectTrigger>
                      <SelectContent>
                        {branchSchedules.map((schedule) => (
                          <SelectItem key={schedule.id} value={schedule.id}>
                            {schedule.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Additional Roles (optional)</Label>
                  <div className="grid gap-2 rounded-md border p-3 md:grid-cols-2">
                    {roles
                      .filter((role) => role.id !== draft.roleId)
                      .map((role) => (
                        <label
                          key={role.id}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={draft.extraRoleIds.includes(role.id)}
                            onCheckedChange={() => {
                              const next = draft.extraRoleIds.includes(role.id)
                                ? draft.extraRoleIds.filter((id) => id !== role.id)
                                : [...draft.extraRoleIds, role.id]
                              updateDraft(userItem.id, { extraRoleIds: next })
                            }}
                          />
                          <span>{role.roleName}</span>
                        </label>
                      ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.active}
                    onCheckedChange={(checked) =>
                      updateDraft(userItem.id, { active: Boolean(checked) })
                    }
                  />
                  Staff active
                </label>

                <Button
                  onClick={() => saveStaff(userItem)}
                  disabled={savingUserId === userItem.id}
                  className="w-fit"
                >
                  {savingUserId === userItem.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Assignment
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
