"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ComponentType } from "react"
import {
  LayoutDashboard,
  BookOpen,
  Users,
  CreditCard,
  CalendarDays,
  CalendarRange,
  BarChart3,
  Settings,
  UserRoundPlus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/hooks/use-auth"
import type { Permission } from "@/lib/types"

const NAV_ITEMS: Array<{
  href: string
  label: string
  permission: Permission
  icon: ComponentType<{ className?: string }>
}> = [
  { href: "/receptionist", label: "Home", permission: "view_dashboard", icon: LayoutDashboard },
  { href: "/receptionist/bookings", label: "Bookings", permission: "view_bookings", icon: BookOpen },
  { href: "/receptionist/customers", label: "Customers", permission: "view_customers", icon: Users },
  { href: "/receptionist/payments", label: "Payments", permission: "view_payments", icon: CreditCard },
  { href: "/receptionist/calendar", label: "Calendar", permission: "view_calendar", icon: CalendarRange },
  { href: "/receptionist/rooms", label: "Rooms", permission: "view_rooms", icon: CalendarDays },
  { href: "/receptionist/visitors", label: "Visitors", permission: "manage_visitors", icon: UserRoundPlus },
  { href: "/receptionist/reports", label: "Reports", permission: "view_reports", icon: BarChart3 },
  { href: "/receptionist/settings", label: "Settings", permission: "view_settings", icon: Settings },
]

export function ReceptionistSidebar() {
  const pathname = usePathname()
  const { hasPermission, isAdminUser } = useAuth()

  const visibleItems = NAV_ITEMS.filter((item) => isAdminUser || hasPermission(item.permission))

  return (
    <aside className="flex hidden h-full max-h-[calc(100vh-4rem)] w-64 shrink-0 flex-col border-r bg-sidebar lg:block">
      <div className="shrink-0 border-b px-4 py-3">
        <p className="text-sm font-semibold text-sidebar-foreground">Receptionist Panel</p>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
        {visibleItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
