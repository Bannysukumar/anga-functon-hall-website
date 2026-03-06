import type { Permission } from "@/lib/types"

export type NavAccessRule = {
  href: string
  label: string
  icon: string
  permissions?: Permission[]
  adminOnly?: boolean
}

const ADMIN_ROUTE_PERMISSIONS: Record<string, Permission[]> = {
  "/admin": ["BOOKINGS_VIEW", "LISTINGS_VIEW", "PAYMENTS_VIEW", "USERS_VIEW", "ATTENDANCE_VIEW_ALL", "SETTINGS_EDIT", "CMS_EDIT", "STAFF_ASSIGN_ROLE"],
  "/admin/bookings": ["BOOKINGS_VIEW"],
  "/admin/listings": ["LISTINGS_VIEW"],
  "/admin/listings/new": ["LISTINGS_CREATE_EDIT"],
  "/admin/payments": ["PAYMENTS_VIEW"],
  "/admin/users": ["USERS_VIEW"],
  "/admin/settings": ["SETTINGS_EDIT"],
  "/admin/roles": ["STAFF_ASSIGN_ROLE"],
  "/admin/staff": ["STAFF_ASSIGN_ROLE"],
  "/admin/attendance": ["ATTENDANCE_VIEW_ALL"],
  "/admin/work-locations": ["SETTINGS_EDIT"],
  "/admin/schedules": ["SETTINGS_EDIT"],
  "/admin/branches": ["SETTINGS_EDIT"],
  "/admin/availability": ["SETTINGS_EDIT"],
  "/admin/coupons": ["CMS_EDIT"],
  "/admin/gallery": ["CMS_EDIT"],
  "/admin/analytics": ["BOOKINGS_VIEW"],
}

const ADMIN_ONLY_PREFIXES: string[] = []

export function getRequiredPermissionsForAdminPath(pathname: string): Permission[] {
  const exact = ADMIN_ROUTE_PERMISSIONS[pathname]
  if (exact) return exact

  if (pathname.startsWith("/admin/listings/") && pathname.endsWith("/edit")) {
    return ["LISTINGS_CREATE_EDIT"]
  }

  if (pathname.startsWith("/admin/listings/")) {
    return ["LISTINGS_VIEW"]
  }

  if (pathname.startsWith("/admin/bookings")) return ["BOOKINGS_VIEW"]
  if (pathname.startsWith("/admin/users")) return ["USERS_VIEW"]
  if (pathname.startsWith("/admin/settings")) return ["SETTINGS_EDIT"]
  if (pathname.startsWith("/admin/payments")) return ["PAYMENTS_VIEW"]
  if (pathname.startsWith("/admin/attendance")) return ["ATTENDANCE_VIEW_ALL"]
  if (pathname.startsWith("/admin/staff") || pathname.startsWith("/admin/roles")) {
    return ["STAFF_ASSIGN_ROLE"]
  }
  if (pathname.startsWith("/admin/work-locations")) return ["SETTINGS_EDIT"]
  if (pathname.startsWith("/admin/schedules")) return ["SETTINGS_EDIT"]
  if (pathname.startsWith("/admin/branches")) return ["SETTINGS_EDIT"]
  if (pathname.startsWith("/admin/availability")) return ["SETTINGS_EDIT"]
  if (pathname.startsWith("/admin/coupons")) return ["CMS_EDIT"]
  if (pathname.startsWith("/admin/gallery")) return ["CMS_EDIT"]
  if (pathname.startsWith("/admin/analytics")) return ["BOOKINGS_VIEW"]

  return []
}

