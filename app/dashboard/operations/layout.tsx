"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/hooks/use-auth"
import type { Permission } from "@/lib/types"
import { Loader2 } from "lucide-react"

function getRoutePermissions(pathname: string): Permission[] {
  if (pathname.endsWith("/bookings")) return ["BOOKINGS_VIEW"]
  if (pathname.endsWith("/listings")) return ["LISTINGS_VIEW"]
  if (pathname.endsWith("/payments")) return ["PAYMENTS_VIEW"]
  if (pathname.endsWith("/users")) return ["USERS_VIEW"]
  if (pathname.endsWith("/settings")) return ["SETTINGS_EDIT"]
  if (pathname.endsWith("/attendance")) return ["ATTENDANCE_VIEW_ALL"]
  return [
    "BOOKINGS_VIEW",
    "LISTINGS_VIEW",
    "PAYMENTS_VIEW",
    "USERS_VIEW",
    "ATTENDANCE_VIEW_ALL",
    "SETTINGS_EDIT",
    "CMS_EDIT",
    "STAFF_ASSIGN_ROLE",
  ]
}

export default function DashboardOperationsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { loading, isAdminUser, hasAnyPermission } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const allowed =
    isAdminUser || hasAnyPermission(getRoutePermissions(pathname))

  useEffect(() => {
    if (!loading && !allowed) {
      router.replace("/access-denied")
    }
  }, [allowed, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!allowed) return null

  return <>{children}</>
}
