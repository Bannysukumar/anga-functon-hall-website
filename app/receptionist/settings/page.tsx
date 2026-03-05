"use client"

import { useEffect, useState } from "react"
import { PermissionGuard } from "@/components/auth/permission-guard"
import { getSettings } from "@/lib/firebase-db"
import type { SiteSettings } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function ReceptionistSettingsPage() {
  const [settings, setSettings] = useState<SiteSettings | null>(null)

  useEffect(() => {
    getSettings().then(setSettings).catch(() => setSettings(null))
  }, [])

  return (
    <PermissionGuard requiredPermissions={["view_settings"]} allowedRoles={["admin", "receptionist"]}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings (Read Only)</h1>
          <p className="text-sm text-muted-foreground">
            Receptionist view of configured business settings.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuration</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p>Service Fee: {settings?.serviceFeePercent ?? 0}%</p>
            <p>Tax: {settings?.taxPercent ?? 0}%</p>
            <p>Contact: {settings?.contactPhone || "-"}</p>
            <p>Email: {settings?.contactEmail || "-"}</p>
            <p>Max Booking Window: {settings?.maxBookingWindowDays ?? 0} days</p>
            <p>Min Advance: {settings?.minAdvancePercent ?? 0}%</p>
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  )
}
