"use client"

import { AdminGuard } from "@/components/auth/admin-guard"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Menu } from "lucide-react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/hooks/use-auth"
import { Spinner } from "@/components/ui/spinner"
import { Alert } from "@/components/ui/alert"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminGuard>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminGuard>
  )
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { user, loading, isAdminUser, authorizationError } = useAuth()

  const allowed = isAdminUser

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace("/login")
      return
    }
    if (authorizationError) return
    if (!allowed) {
      router.replace("/access-denied")
    }
  }, [allowed, authorizationError, loading, router, user])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!user) return null

  if (authorizationError) {
    return (
      <div className="mx-auto mt-8 w-full max-w-xl">
        <Alert>{authorizationError}</Alert>
      </div>
    )
  }

  if (!allowed) return null

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden lg:block">
        <AdminSidebar />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-14 items-center border-b px-4 lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open admin menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Admin navigation</SheetTitle>
              <SheetDescription className="sr-only">
                Open the admin panel navigation menu.
              </SheetDescription>
              <AdminSidebar />
            </SheetContent>
          </Sheet>
          <span className="ml-3 text-sm font-semibold text-foreground">
            Admin Panel
          </span>
        </div>
        <main className="flex-1 overflow-y-auto bg-background p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
