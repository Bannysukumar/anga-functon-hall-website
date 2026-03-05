"use client"

import { PermissionGuard } from "@/components/auth/permission-guard"
import { ReceptionistSidebar } from "@/components/receptionist/receptionist-sidebar"

export default function ReceptionistLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PermissionGuard allowedRoles={["admin", "receptionist"]} requiredPermissions={["view_dashboard"]}>
      <div className="flex min-h-[calc(100vh-4rem)]">
        <ReceptionistSidebar />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </PermissionGuard>
  )
}
