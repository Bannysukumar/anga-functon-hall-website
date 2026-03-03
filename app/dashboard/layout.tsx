"use client"

import { useAuth } from "@/lib/hooks/use-auth"
import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  CalendarDays,
  Heart,
  User,
  Loader2,
  ShieldCheck,
  ClipboardCheck,
  BookOpen,
  ListChecks,
  CreditCard,
  Users,
  Settings,
} from "lucide-react"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading, staffProfile, hasPermission, hasAnyPermission, isAdminUser } =
    useAuth()
  const canAccessAdminPanel =
    isAdminUser ||
    hasAnyPermission([
      "BOOKINGS_VIEW",
      "LISTINGS_VIEW",
      "PAYMENTS_VIEW",
      "USERS_VIEW",
      "ATTENDANCE_VIEW_ALL",
      "SETTINGS_EDIT",
      "CMS_EDIT",
      "STAFF_ASSIGN_ROLE",
    ])

  const opsLinks = [
    ...(isAdminUser || hasPermission("BOOKINGS_VIEW")
      ? [
          {
            href: "/dashboard/operations/bookings",
            label: "Manage Bookings",
            icon: BookOpen,
          },
        ]
      : []),
    ...(isAdminUser || hasPermission("LISTINGS_VIEW")
      ? [
          {
            href: "/dashboard/operations/listings",
            label: "Manage Listings",
            icon: ListChecks,
          },
        ]
      : []),
    ...(isAdminUser || hasPermission("PAYMENTS_VIEW")
      ? [
          {
            href: "/dashboard/operations/payments",
            label: "Payments",
            icon: CreditCard,
          },
        ]
      : []),
    ...(isAdminUser || hasPermission("USERS_VIEW")
      ? [{ href: "/dashboard/operations/users", label: "Users", icon: Users }]
      : []),
    ...(isAdminUser || hasPermission("SETTINGS_EDIT")
      ? [
          {
            href: "/dashboard/operations/settings",
            label: "Settings",
            icon: Settings,
          },
        ]
      : []),
    ...(isAdminUser || hasPermission("ATTENDANCE_VIEW_ALL")
      ? [
          {
            href: "/dashboard/operations/attendance",
            label: "Attendance",
            icon: ClipboardCheck,
          },
        ]
      : []),
  ]

  const sidebarLinks = [
    { href: "/dashboard", label: "My Bookings", icon: CalendarDays },
    { href: "/dashboard/favorites", label: "Favorites", icon: Heart },
    { href: "/dashboard/profile", label: "Profile", icon: User },
    ...(staffProfile
      ? [{ href: "/dashboard/my-role", label: "My Role", icon: ShieldCheck }]
      : []),
    ...(hasPermission("ATTENDANCE_SELF_MARK")
      ? [
          {
            href: "/dashboard/my-attendance",
            label: "My Attendance",
            icon: ClipboardCheck,
          },
        ]
      : []),
  ]

  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-10rem)] gap-8 px-4 py-8">
      <aside className="hidden w-56 shrink-0 md:block">
        <nav className="sticky top-24 flex flex-col gap-1">
          {[
            ...sidebarLinks,
            ...(canAccessAdminPanel
              ? [{ href: "/dashboard/operations", label: "Ops", icon: ShieldCheck }]
              : []),
          ].map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/dashboard" && pathname.startsWith(link.href))
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            )
          })}
          {canAccessAdminPanel && opsLinks.length > 0 && (
            <>
              <div className="my-2 border-t" />
              <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Operations
              </p>
              {opsLinks.map((link) => {
                const isActive =
                  pathname === link.href ||
                  (link.href !== "/dashboard" && pathname.startsWith(link.href))
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                )
              })}
            </>
          )}
        </nav>
      </aside>

      {/* Mobile nav */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card md:hidden">
        <nav className="flex items-center justify-around py-2">
          {sidebarLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/dashboard" && pathname.startsWith(link.href))
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <link.icon className="h-5 w-5" />
                {link.label}
              </Link>
            )
          })}
        </nav>
      </div>

      <main className="flex-1 pb-20 md:pb-0">{children}</main>
    </div>
  )
}
