"use client"

import { useEffect, useState } from "react"
import {
  createRole,
  deleteRole,
  getRoles,
  updateRole,
  createAuditLog,
} from "@/lib/firebase-db"
import type { Permission, Role } from "@/lib/types"
import { ALL_PERMISSIONS, PERMISSION_LABELS } from "@/lib/constants"
import { useAuth } from "@/lib/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"

export default function AdminRolesPage() {
  const { user } = useAuth()
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newRoleName, setNewRoleName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newPermissions, setNewPermissions] = useState<Permission[]>([])

  async function loadRoles() {
    setLoading(true)
    try {
      const data = await getRoles()
      setRoles(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRoles()
  }, [])

  async function handleCreateRole() {
    if (!newRoleName.trim()) {
      toast.error("Role name is required.")
      return
    }
    setCreating(true)
    try {
      const roleId = await createRole({
        roleName: newRoleName.trim(),
        description: newDescription.trim(),
        permissions: newPermissions,
      })
      try {
        await createAuditLog({
          entity: "role",
          entityId: roleId,
          action: "CREATE",
          message: `Created role ${newRoleName.trim()}`,
          payload: { roleName: newRoleName.trim(), permissions: newPermissions },
          createdBy: user?.uid || "",
        })
      } catch {
        // Do not fail role creation if audit logging fails.
      }
      toast.success("Role created")
      setDialogOpen(false)
      setNewRoleName("")
      setNewDescription("")
      setNewPermissions([])
      loadRoles()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create role."
      toast.error(message)
    } finally {
      setCreating(false)
    }
  }

  async function handleUpdate(role: Role) {
    setSavingId(role.id)
    try {
      await updateRole(role.id, {
        roleName: role.roleName,
        description: role.description,
        permissions: role.permissions,
      })
      try {
        await createAuditLog({
          entity: "role",
          entityId: role.id,
          action: "UPDATE",
          message: `Updated role ${role.roleName}`,
          payload: { permissions: role.permissions },
          createdBy: user?.uid || "",
        })
      } catch {
        // Do not fail role update if audit logging fails.
      }
      toast.success("Role updated")
      loadRoles()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update role."
      toast.error(message)
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete(role: Role) {
    try {
      await deleteRole(role.id)
      try {
        await createAuditLog({
          entity: "role",
          entityId: role.id,
          action: "DELETE",
          message: `Deleted role ${role.roleName}`,
          payload: {},
          createdBy: user?.uid || "",
        })
      } catch {
        // Do not fail role delete if audit logging fails.
      }
      toast.success("Role deleted")
      loadRoles()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete role."
      toast.error(message)
    }
  }

  function toggleNewPermission(permission: Permission) {
    setNewPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    )
  }

  function toggleRolePermission(roleId: string, permission: Permission) {
    setRoles((prev) =>
      prev.map((role) => {
        if (role.id !== roleId) return role
        const next = role.permissions.includes(permission)
          ? role.permissions.filter((p) => p !== permission)
          : [...role.permissions, permission]
        return { ...role, permissions: next }
      })
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Role Manager</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage staff roles with permissions.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Role
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Role</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="roleName">Role Name</Label>
                <Input
                  id="roleName"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="Receptionist"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="roleDescription">Description</Label>
                <Textarea
                  id="roleDescription"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Handles walk-ins and booking desk support."
                />
              </div>
              <div className="grid gap-2">
                <Label>Permissions</Label>
                <div className="grid gap-2 rounded-md border p-3 md:grid-cols-2">
                  {ALL_PERMISSIONS.map((permission) => (
                    <label
                      key={permission}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={newPermissions.includes(permission)}
                        onCheckedChange={() => toggleNewPermission(permission)}
                      />
                      <span>{PERMISSION_LABELS[permission]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button onClick={handleCreateRole} disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Role
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {roles.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No roles created yet.
            </CardContent>
          </Card>
        ) : (
          roles.map((role) => (
            <Card key={role.id}>
              <CardHeader>
                <CardTitle className="text-base">{role.roleName}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Role Name</Label>
                  <Input
                    value={role.roleName}
                    onChange={(e) =>
                      setRoles((prev) =>
                        prev.map((r) =>
                          r.id === role.id ? { ...r, roleName: e.target.value } : r
                        )
                      )
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Textarea
                    value={role.description}
                    onChange={(e) =>
                      setRoles((prev) =>
                        prev.map((r) =>
                          r.id === role.id
                            ? { ...r, description: e.target.value }
                            : r
                        )
                      )
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Permissions</Label>
                  <div className="grid gap-2 rounded-md border p-3 md:grid-cols-2">
                    {ALL_PERMISSIONS.map((permission) => (
                      <label
                        key={permission}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={role.permissions.includes(permission)}
                          onCheckedChange={() =>
                            toggleRolePermission(role.id, permission)
                          }
                        />
                        <span>{PERMISSION_LABELS[permission]}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {role.permissions.map((permission) => (
                    <Badge key={permission} variant="secondary">
                      {permission}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleUpdate(role)}
                    disabled={savingId === role.id}
                  >
                    {savingId === role.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete role?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(role)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
