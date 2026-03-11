"use client"

import {
  getAllUsers,
  getBookings,
  getListings,
} from "@/lib/firebase-db"
import type { AppUser, Booking, Listing } from "@/lib/types"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Loader2,
  MoreHorizontal,
  Search,
  Users,
  ShieldOff,
  Shield,
  UserCog,
  Eye,
  Plus,
  RefreshCw,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/hooks/use-auth"
import {
  adminCreateUser,
  adminEditUser,
  adminResendCredentials,
  adminSetUserStatus,
} from "@/lib/admin-user-functions"

const DETAILS_PAGE_SIZE = 5

export default function AdminUsersPage() {
  const { toast } = useToast()
  const { hasPermission, isAdminUser } = useAuth()
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "receptionist">("all")
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [selectedUserBookings, setSelectedUserBookings] = useState<Booking[]>([])
  const [selectedUserFavorites, setSelectedUserFavorites] = useState<Listing[]>([])
  const [bookingsPage, setBookingsPage] = useState(1)
  const [favoritesPage, setFavoritesPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    mobileNumber: "",
    role: "user",
  })
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    mobileNumber: "",
    role: "user",
  })

  const loadUsers = async () => {
    setLoading(true)
    try {
      const data = await getAllUsers()
      setUsers(data)
    } catch (err) {
      console.error("Error loading users:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleToggleBlock = async (user: AppUser) => {
    if (!isAdminUser && !hasPermission("USERS_BLOCK_UNBLOCK")) {
      toast({
        title: "Permission denied",
        description: "You do not have permission to block/unblock users.",
        variant: "destructive",
      })
      return
    }
    try {
      await adminSetUserStatus(user.id, !user.isBlocked)
      toast({
        title: user.isBlocked ? "User enabled" : "User disabled",
      })
      loadUsers()
    } catch {
      toast({
        title: "Error",
        description: "Failed to update user.",
        variant: "destructive",
      })
    }
  }

  const filtered = users.filter((u) => {
    const role = (u.role || "user").toLowerCase()
    if (roleFilter !== "all" && role !== roleFilter) return false
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      u.email?.toLowerCase().includes(q) ||
      u.displayName?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      (u.role || "user").toLowerCase().includes(q)
    )
  })

  const handleRoleUpdate = async (
    user: AppUser,
    role: "user" | "admin" | "receptionist" | "staff" | "cleaner" | "watchman"
  ) => {
    if (!isAdminUser) {
      toast({
        title: "Permission denied",
        description: "Only admin can change user roles.",
        variant: "destructive",
      })
      return
    }
    const adminCount = users.filter((u) => (u.role || "user") === "admin").length
    if ((user.role || "user") === "admin" && role !== "admin" && adminCount <= 1) {
      toast({
        title: "Cannot remove last admin",
        description: "At least one admin account is required.",
        variant: "destructive",
      })
      return
    }
    try {
      await adminEditUser(user.id, {
        name: user.displayName || "",
        email: user.email || "",
        mobileNumber: user.mobileNumber || user.phone || "",
        role,
      })
      toast({
        title: `Role updated to ${role}`,
      })
      loadUsers()
    } catch {
      toast({
        title: "Error",
        description: "Failed to update role.",
        variant: "destructive",
      })
    }
  }

  const handleResetPassword = async (user: AppUser) => {
    if (!isAdminUser) {
      toast({
        title: "Permission denied",
        description: "Only admins can reset passwords.",
        variant: "destructive",
      })
      return
    }
    try {
      const result = await adminResendCredentials(user.id, "reset")
      toast({
        title: result.emailSent
          ? "Password reset and credentials sent"
          : "Password reset done, email failed",
        description: result.emailSent
          ? `New credentials sent to ${user.email}`
          : "User password was reset but email delivery failed.",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to send password reset email.",
        variant: "destructive",
      })
    }
  }

  const handleCreateUser = async () => {
    if (!isAdminUser) {
      toast({ title: "Permission denied", description: "Only admins can create users.", variant: "destructive" })
      return
    }
    setBusy(true)
    try {
      const result = await adminCreateUser(createForm)
      setCreateOpen(false)
      setCreateForm({ name: "", email: "", mobileNumber: "", role: "user" })
      toast({
        title: result.emailSent ? "User created and credentials emailed" : "User created, email failed",
        description: result.emailSent ? "Login credentials sent successfully." : "User created but email delivery failed.",
        variant: result.emailSent ? "default" : "destructive",
      })
      if (!result.emailSent && result.warning) {
        toast({
          title: "Email error details",
          description: result.warning,
          variant: "destructive",
        })
      }
      await loadUsers()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create user.",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  const handleResendCredentials = async (user: AppUser) => {
    try {
      const result = await adminResendCredentials(user.id, "resend")
      toast({
        title: result.emailSent ? "Credentials sent" : "Email delivery failed",
        description: result.emailSent
          ? `Credentials sent to ${user.email}`
          : "Credentials were reset but email delivery failed.",
        variant: result.emailSent ? "default" : "destructive",
      })
      if (!result.emailSent && result.warning) {
        toast({
          title: "Email error details",
          description: result.warning,
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to resend credentials.",
        variant: "destructive",
      })
    }
  }

  const openEditUser = (user: AppUser) => {
    setSelectedUser(user)
    setEditForm({
      name: user.displayName || "",
      email: user.email || "",
      mobileNumber: user.mobileNumber || user.phone || "",
      role: String(user.role || "user"),
    })
    setEditOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedUser) return
    setBusy(true)
    try {
      await adminEditUser(selectedUser.id, editForm)
      setEditOpen(false)
      toast({ title: "User details updated" })
      await loadUsers()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update user.",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  const openUserDetails = async (user: AppUser) => {
    setSelectedUser(user)
    setDetailsOpen(true)
    setDetailsLoading(true)
    setBookingsPage(1)
    setFavoritesPage(1)
    try {
      const [bookings, listings] = await Promise.all([
        getBookings({ userId: user.id }),
        getListings(),
      ])
      setSelectedUserBookings(bookings)
      const favorites = listings.filter((listing) =>
        (user.favorites || []).includes(listing.id)
      )
      setSelectedUserFavorites(favorites)
    } catch {
      toast({
        title: "Error",
        description: "Failed to load full user details.",
        variant: "destructive",
      })
      setSelectedUserBookings([])
      setSelectedUserFavorites([])
    } finally {
      setDetailsLoading(false)
    }
  }

  const totalBookingPages = Math.max(
    1,
    Math.ceil(selectedUserBookings.length / DETAILS_PAGE_SIZE)
  )
  const totalFavoritePages = Math.max(
    1,
    Math.ceil(selectedUserFavorites.length / DETAILS_PAGE_SIZE)
  )
  const pagedBookings = selectedUserBookings.slice(
    (bookingsPage - 1) * DETAILS_PAGE_SIZE,
    bookingsPage * DETAILS_PAGE_SIZE
  )
  const pagedFavorites = selectedUserFavorites.slice(
    (favoritesPage - 1) * DETAILS_PAGE_SIZE,
    favoritesPage * DETAILS_PAGE_SIZE
  )

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Users</h1>
        <p className="text-sm text-muted-foreground">
          {users.length} registered users
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              All Users
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button onClick={() => setCreateOpen(true)} disabled={!isAdminUser}>
                <Plus className="mr-2 h-4 w-4" />
                Create User
              </Button>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            {(["all", "admin", "receptionist"] as const).map((item) => (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={roleFilter === item ? "default" : "outline"}
                onClick={() => setRoleFilter(item)}
              >
                {item === "all" ? "All" : item === "admin" ? "Admin" : "Receptionist"}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((u) => {
                    const initials = (u.displayName || u.email || "U")
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()

                    const joinDate = u.createdAt?.toDate
                      ? u.createdAt.toDate().toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "N/A"

                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-xs text-primary">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-foreground">
                              {u.displayName || "Unnamed"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {u.email}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {u.phone || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {joinDate}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              (u.role || "user") === "admin"
                                ? "bg-violet-100 text-violet-800"
                                : ""
                            }
                          >
                            {(u.role || "user").toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {u.isBlocked ? (
                            <Badge variant="destructive">Blocked</Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="bg-emerald-100 text-emerald-800"
                            >
                              Active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleRoleUpdate(u, "admin")}
                                disabled={!isAdminUser}
                              >
                                <UserCog className="mr-2 h-4 w-4" />
                                Set as Admin
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleRoleUpdate(u, "receptionist")}
                                disabled={!isAdminUser}
                              >
                                <UserCog className="mr-2 h-4 w-4" />
                                Set as Receptionist
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleRoleUpdate(u, "staff")}
                                disabled={!isAdminUser}
                              >
                                <UserCog className="mr-2 h-4 w-4" />
                                Set as Staff
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleRoleUpdate(u, "cleaner")}
                                disabled={!isAdminUser}
                              >
                                <UserCog className="mr-2 h-4 w-4" />
                                Set as Cleaner
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleRoleUpdate(u, "watchman")}
                                disabled={!isAdminUser}
                              >
                                <UserCog className="mr-2 h-4 w-4" />
                                Set as Watchman
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleRoleUpdate(u, "user")}
                                disabled={!isAdminUser}
                              >
                                <UserCog className="mr-2 h-4 w-4" />
                                Set as User
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleToggleBlock(u)}
                                disabled={!isAdminUser && !hasPermission("USERS_BLOCK_UNBLOCK")}
                              >
                                {u.isBlocked ? (
                                  <>
                                    <Shield className="mr-2 h-4 w-4" />
                                    Enable User
                                  </>
                                ) : (
                                  <>
                                    <ShieldOff className="mr-2 h-4 w-4" />
                                    Disable User
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openEditUser(u)}
                                disabled={!isAdminUser}
                              >
                                <UserCog className="mr-2 h-4 w-4" />
                                Edit User Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleResendCredentials(u)}
                                disabled={!isAdminUser}
                              >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Resend Login Credentials
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openUserDetails(u)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Full Data
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleResetPassword(u)}
                                disabled={!isAdminUser}
                              >
                                <Shield className="mr-2 h-4 w-4" />
                                Reset Password (New Credentials)
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              Full stored user data for admin review.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p>
                  <span className="font-medium">Name:</span>{" "}
                  {selectedUser.displayName || "Unnamed"}
                </p>
                <p>
                  <span className="font-medium">Email:</span> {selectedUser.email}
                </p>
                <p>
                  <span className="font-medium">Phone:</span>{" "}
                  {selectedUser.phone || "-"}
                </p>
                <p>
                  <span className="font-medium">Role:</span>{" "}
                  {(selectedUser.role || "user").toUpperCase()}
                </p>
                <p>
                  <span className="font-medium">Blocked:</span>{" "}
                  {selectedUser.isBlocked ? "Yes" : "No"}
                </p>
                <p>
                  <span className="font-medium">Favorites:</span>{" "}
                  {selectedUser.favorites?.length || 0}
                </p>
              </div>
              {detailsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-md border p-3">
                    <p className="text-sm font-medium text-foreground">Bookings</p>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <p>Total: {selectedUserBookings.length}</p>
                      <p>
                        Confirmed:{" "}
                        {
                          selectedUserBookings.filter(
                            (booking) =>
                              booking.status === "confirmed" ||
                              booking.status === "completed"
                          ).length
                        }
                      </p>
                      <p>
                        Spent: ₹
                        {selectedUserBookings
                          .filter((booking) => booking.status !== "cancelled")
                          .reduce(
                            (total, booking) => total + (booking.totalAmount || 0),
                            0
                          )
                          .toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="mt-3 max-h-36 overflow-auto rounded border">
                      {selectedUserBookings.length === 0 ? (
                        <p className="p-2 text-xs text-muted-foreground">
                          No bookings found.
                        </p>
                      ) : (
                        pagedBookings.map((booking) => (
                          <div
                            key={booking.id}
                            className="flex items-center justify-between border-b px-2 py-1.5 text-xs last:border-b-0"
                          >
                            <span className="truncate">{booking.listingTitle}</span>
                            <span className="text-muted-foreground">
                              ₹{booking.totalAmount.toLocaleString("en-IN")}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                    {selectedUserBookings.length > DETAILS_PAGE_SIZE && (
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          Page {bookingsPage} of {totalBookingPages}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={bookingsPage <= 1}
                            onClick={() =>
                              setBookingsPage((page) => Math.max(1, page - 1))
                            }
                          >
                            Prev
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={bookingsPage >= totalBookingPages}
                            onClick={() =>
                              setBookingsPage((page) =>
                                Math.min(totalBookingPages, page + 1)
                              )
                            }
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                    {selectedUser && selectedUserBookings.length > 0 && (
                      <div className="mt-2">
                        <Button asChild size="sm" variant="secondary">
                          <Link
                            href={{
                              pathname: "/admin/bookings",
                              query: {
                                userId: selectedUser.id,
                                userEmail: selectedUser.email,
                              },
                            }}
                          >
                            View All Bookings
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="rounded-md border p-3">
                    <p className="text-sm font-medium text-foreground">Favorites</p>
                    <div className="mt-2 max-h-32 overflow-auto rounded border">
                      {selectedUserFavorites.length === 0 ? (
                        <p className="p-2 text-xs text-muted-foreground">
                          No favorite listings.
                        </p>
                      ) : (
                        pagedFavorites.map((listing) => (
                          <div
                            key={listing.id}
                            className="flex items-center justify-between border-b px-2 py-1.5 text-xs last:border-b-0"
                          >
                            <span className="truncate">{listing.title}</span>
                            <span className="text-muted-foreground">
                              ₹{listing.pricePerUnit.toLocaleString("en-IN")}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                    {selectedUserFavorites.length > DETAILS_PAGE_SIZE && (
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          Page {favoritesPage} of {totalFavoritePages}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={favoritesPage <= 1}
                            onClick={() =>
                              setFavoritesPage((page) => Math.max(1, page - 1))
                            }
                          >
                            Prev
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={favoritesPage >= totalFavoritePages}
                            onClick={() =>
                              setFavoritesPage((page) =>
                                Math.min(totalFavoritePages, page + 1)
                              )
                            }
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>
              Password is generated automatically and sent via email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="User name"
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              placeholder="Email"
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
            />
            <Input
              placeholder="Mobile number"
              value={createForm.mobileNumber}
              onChange={(e) =>
                setCreateForm((f) => ({
                  ...f,
                  mobileNumber: e.target.value.replace(/\D/g, "").slice(0, 10),
                }))
              }
            />
            <Input
              placeholder="Role (user/staff/receptionist/cleaner/watchman/admin)"
              value={createForm.role}
              onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value.toLowerCase() }))}
            />
            <Button onClick={handleCreateUser} disabled={busy} className="w-full">
              {busy ? "Creating..." : "Create User"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Details</DialogTitle>
            <DialogDescription>Update user profile fields and role.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="User name"
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              placeholder="Email"
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
            />
            <Input
              placeholder="Mobile number"
              value={editForm.mobileNumber}
              onChange={(e) =>
                setEditForm((f) => ({
                  ...f,
                  mobileNumber: e.target.value.replace(/\D/g, "").slice(0, 10),
                }))
              }
            />
            <Input
              placeholder="Role (user/staff/receptionist/cleaner/watchman/admin)"
              value={editForm.role}
              onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value.toLowerCase() }))}
            />
            <Button onClick={handleSaveEdit} disabled={busy} className="w-full">
              {busy ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
