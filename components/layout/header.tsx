"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/lib/hooks/use-auth"
import { logOut } from "@/lib/firebase-auth"
import { Button } from "@/components/ui/button"
import { SiteLogo } from "@/components/layout/site-logo"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Menu, X, User, LayoutDashboard, Shield, LogOut } from "lucide-react"
import { toast } from "sonner"
import { useState } from "react"

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/contact", label: "Contact" },
]

export function Header() {
  const { user, loading, isAdminUser, hasAnyPermission } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    try {
      await logOut()
      toast.success("Logged out successfully")
      router.push("/")
    } catch {
      toast.error("Logout failed")
    }
  }

  const initials = user?.displayName
    ? user.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || "U"

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

  const operationsHref = isAdminUser ? "/admin" : "/dashboard/operations"

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <SiteLogo />
        </Link>

        <div className="flex items-center gap-3">
          <nav className="hidden items-center rounded-full border bg-secondary/40 p-1 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {!loading && (
            <>
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-9 w-9 rounded-full"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium text-foreground">
                        {user.displayName || "User"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard" className="cursor-pointer">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        href="/dashboard/profile"
                        className="cursor-pointer"
                      >
                        <User className="mr-2 h-4 w-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    {canAccessAdminPanel && (
                      <DropdownMenuItem asChild>
                        <Link href={operationsHref} className="cursor-pointer">
                          <Shield className="mr-2 h-4 w-4" />
                          Operations Panel
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="cursor-pointer text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="hidden items-center gap-2 sm:flex">
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/login">
                      Sign In
                    </Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href="/signup">Get Started</Link>
                  </Button>
                </div>
              )}
            </>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t bg-background/95 p-4 backdrop-blur md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-3 rounded-xl border bg-secondary/30 p-3 shadow-sm">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-background/70 hover:text-primary"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {!loading && user && (
              <div className="flex flex-col gap-2 border-t pt-3">
                <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Button>
                </Link>
                <Link href="/dashboard/profile" onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <User className="h-4 w-4" />
                    Profile
                  </Button>
                </Link>
                {canAccessAdminPanel && (
                  <Link href={operationsHref} onClick={() => setMobileOpen(false)}>
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <Shield className="h-4 w-4" />
                      Operations Panel
                    </Button>
                  </Link>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full justify-start"
                  onClick={async () => {
                    setMobileOpen(false)
                    await handleLogout()
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </Button>
              </div>
            )}
            {!loading && !user && (
              <div className="flex flex-col gap-2 border-t pt-3">
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    Sign In
                  </Link>
                </Button>
                <Button asChild size="sm" className="w-full">
                  <Link href="/signup" onClick={() => setMobileOpen(false)}>
                    Get Started
                  </Link>
                </Button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
