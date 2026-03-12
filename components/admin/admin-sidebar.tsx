"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ComponentType } from "react"
import {
  LayoutDashboard,
  Building,
  ListChecks,
  CalendarDays,
  CreditCard,
  Ticket,
  Settings,
  BookOpen,
  ChevronLeft,
  Users,
  BarChart3,
  ShieldCheck,
  UserCog,
  MapPinned,
  Clock3,
  ClipboardCheck,
  Banknote,
  Images,
  Gift,
  Megaphone,
  ImageIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/hooks/use-auth"
import type { Permission } from "@/lib/types"

const ADMIN_NAV: Array<{
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
  permissions?: Permission[]
  adminOnly?: boolean
}> = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, permissions: ["BOOKINGS_VIEW", "LISTINGS_VIEW", "PAYMENTS_VIEW", "USERS_VIEW", "ATTENDANCE_VIEW_ALL", "SETTINGS_EDIT", "CMS_EDIT", "STAFF_ASSIGN_ROLE"] },
  { href: "/admin/branches", label: "Branches", icon: Building, permissions: ["SETTINGS_EDIT"] },
  { href: "/admin/listings", label: "Listings", icon: ListChecks, permissions: ["LISTINGS_VIEW"] },
  { href: "/admin/bookings", label: "Bookings", icon: BookOpen, permissions: ["BOOKINGS_VIEW"] },
  { href: "/admin/availability", label: "Availability", icon: CalendarDays, permissions: ["SETTINGS_EDIT"] },
  { href: "/admin/payments", label: "Payments", icon: CreditCard, permissions: ["PAYMENTS_VIEW"] },
  { href: "/admin/refunds", label: "Refunds", icon: Banknote, permissions: ["REFUNDS_MANAGE"] },
  { href: "/admin/coupons", label: "Coupons", icon: Ticket, permissions: ["CMS_EDIT"] },
  { href: "/admin/rewards", label: "Rewards", icon: Gift, permissions: ["CMS_EDIT"] },
  { href: "/admin/campaigns", label: "Campaigns", icon: Megaphone, permissions: ["CMS_EDIT"] },
  { href: "/admin/gallery", label: "Gallery", icon: Images, permissions: ["CMS_EDIT"] },
  { href: "/admin/hero-images", label: "Hero Images", icon: ImageIcon, permissions: ["CMS_EDIT"] },
  { href: "/admin/users", label: "Users", icon: Users, permissions: ["USERS_VIEW"] },
  { href: "/admin/roles", label: "Roles", icon: ShieldCheck, permissions: ["STAFF_ASSIGN_ROLE"] },
  { href: "/admin/staff", label: "Staff", icon: UserCog, permissions: ["STAFF_ASSIGN_ROLE"] },
  { href: "/admin/work-locations", label: "Work Locations", icon: MapPinned, permissions: ["SETTINGS_EDIT"] },
  { href: "/admin/schedules", label: "Schedules", icon: Clock3, permissions: ["SETTINGS_EDIT"] },
  { href: "/admin/attendance", label: "Attendance", icon: ClipboardCheck, permissions: ["ATTENDANCE_VIEW_ALL"] },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, permissions: ["BOOKINGS_VIEW"] },
  { href: "/admin/settings", label: "Settings", icon: Settings, permissions: ["SETTINGS_EDIT"] },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const { isAdminUser, hasAnyPermission } = useAuth()

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-sidebar">
      <div className="flex h-16 items-center justify-between border-b px-4">
        <h2 className="text-sm font-semibold text-sidebar-foreground">
          Admin Panel
        </h2>
        <Link
          href="/"
          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
        >
          <ChevronLeft className="h-3 w-3" />
          Site
        </Link>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
        {ADMIN_NAV.filter((item) => {
          if (isAdminUser) return true
          if (item.adminOnly) return false
          if (!item.permissions || item.permissions.length === 0) return false
          return hasAnyPermission(item.permissions)
        }).map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
