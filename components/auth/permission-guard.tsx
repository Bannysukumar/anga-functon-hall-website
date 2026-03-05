"use client"

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/lib/hooks/use-auth"
import type { Permission } from "@/lib/types"

type PermissionGuardProps = {
  children: ReactNode
  requiredPermissions?: Permission[]
  allowedRoles?: Array<"admin" | "receptionist" | "user">
}

export function PermissionGuard({
  children,
  requiredPermissions = [],
  allowedRoles = [],
}: PermissionGuardProps) {
  const { loading, user, appUser, isAdminUser, hasAnyPermission } = useAuth()
  const router = useRouter()

  const role = appUser?.role || "user"
  const roleAllowed = allowedRoles.length === 0 ? true : allowedRoles.includes(role)
  const permissionAllowed =
    requiredPermissions.length === 0 ? true : isAdminUser || hasAnyPermission(requiredPermissions)
  const allowed = roleAllowed && permissionAllowed

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace("/login")
      return
    }
    if (!allowed) {
      router.replace("/access-denied")
    }
  }, [allowed, loading, router, user])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!user || !allowed) return null
  return <>{children}</>
}
