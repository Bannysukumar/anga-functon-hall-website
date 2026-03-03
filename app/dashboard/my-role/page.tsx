"use client"

import { useEffect, useMemo, useState } from "react"
import { getBranches, getRoles, getAttendanceSchedules, getWorkLocations } from "@/lib/firebase-db"
import { useAuth } from "@/lib/hooks/use-auth"
import type { AttendanceSchedule, Branch, Role, WorkLocation } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"

export default function MyRolePage() {
  const { staffProfile, permissions } = useAuth()
  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState<Role[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [locations, setLocations] = useState<WorkLocation[]>([])
  const [schedules, setSchedules] = useState<AttendanceSchedule[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [roleData, branchData, locationData, scheduleData] = await Promise.all([
          getRoles(),
          getBranches(),
          getWorkLocations(),
          getAttendanceSchedules(),
        ])
        setRoles(roleData)
        setBranches(branchData)
        setLocations(locationData)
        setSchedules(scheduleData)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const roleName = useMemo(() => {
    if (!staffProfile?.roleId) return "-"
    return roles.find((role) => role.id === staffProfile.roleId)?.roleName || "-"
  }, [roles, staffProfile])

  const extraRoleNames = useMemo(() => {
    if (!staffProfile?.extraRoleIds?.length) return []
    return staffProfile.extraRoleIds
      .map((roleId) => roles.find((role) => role.id === roleId)?.roleName || roleId)
      .filter(Boolean)
  }, [roles, staffProfile])

  const branchName =
    branches.find((branch) => branch.id === staffProfile?.branchId)?.name || "-"
  const locationName =
    locations.find((location) => location.id === staffProfile?.workLocationId)?.name ||
    "-"
  const scheduleName =
    schedules.find((schedule) => schedule.id === staffProfile?.scheduleId)?.name || "-"

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!staffProfile) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No staff assignment found for your account.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Role & Permissions</h1>
        <p className="text-sm text-muted-foreground">
          Your assigned role, location, schedule, and allowed actions.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assignment</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <p>
            <span className="font-medium text-foreground">Status:</span>{" "}
            {staffProfile.active ? "Active" : "Inactive"}
          </p>
          <p>
            <span className="font-medium text-foreground">Primary role:</span> {roleName}
          </p>
          <p>
            <span className="font-medium text-foreground">Extra roles:</span>{" "}
            {extraRoleNames.length > 0 ? extraRoleNames.join(", ") : "None"}
          </p>
          <p>
            <span className="font-medium text-foreground">Branch:</span> {branchName}
          </p>
          <p>
            <span className="font-medium text-foreground">Work location:</span>{" "}
            {locationName}
          </p>
          <p>
            <span className="font-medium text-foreground">Schedule:</span> {scheduleName}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permissions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {permissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No permissions assigned yet.
            </p>
          ) : (
            permissions.map((permission) => (
              <Badge key={permission} variant="secondary">
                {permission}
              </Badge>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
