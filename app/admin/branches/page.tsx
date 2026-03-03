"use client"

import { useEffect, useState } from "react"
import {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
} from "@/lib/firebase-db"
import type { Branch } from "@/lib/types"
import { INDIAN_STATES } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"

const EMPTY_BRANCH = {
  name: "",
  address: "",
  city: "",
  state: "",
  contactNumber: "",
  mapLink: "",
  timings: "",
  isActive: true,
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_BRANCH)

  async function loadBranches() {
    try {
      const data = await getBranches()
      setBranches(data)
    } catch {
      toast.error("Failed to load branches")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBranches()
  }, [])

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_BRANCH)
    setDialogOpen(true)
  }

  function openEdit(branch: Branch) {
    setEditingId(branch.id)
    setForm({
      name: branch.name,
      address: branch.address,
      city: branch.city,
      state: branch.state,
      contactNumber: branch.contactNumber,
      mapLink: branch.mapLink,
      timings: branch.timings,
      isActive: branch.isActive,
    })
    setDialogOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.city || !form.state) {
      toast.error("Name, city, and state are required")
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await updateBranch(editingId, form)
        toast.success("Branch updated")
      } else {
        await createBranch(form)
        toast.success("Branch created")
      }
      setDialogOpen(false)
      await loadBranches()
    } catch {
      toast.error("Failed to save branch")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this branch?")) return
    try {
      await deleteBranch(id)
      toast.success("Branch deleted")
      await loadBranches()
    } catch {
      toast.error("Failed to delete branch")
    }
  }

  async function handleToggleActive(branch: Branch) {
    try {
      await updateBranch(branch.id, { isActive: !branch.isActive })
      await loadBranches()
    } catch {
      toast.error("Failed to update branch")
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Branches</h1>
          <p className="text-sm text-muted-foreground">
            Manage your venue locations
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Branch
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit Branch" : "Add Branch"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>Branch Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  placeholder="Main Branch"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Address</Label>
                <Input
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  placeholder="123 Street Name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>City *</Label>
                  <Input
                    value={form.city}
                    onChange={(e) =>
                      setForm({ ...form, city: e.target.value })
                    }
                    placeholder="Mumbai"
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>State *</Label>
                  <Select
                    value={form.state}
                    onValueChange={(v) => setForm({ ...form, state: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDIAN_STATES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Contact Number</Label>
                  <Input
                    value={form.contactNumber}
                    onChange={(e) =>
                      setForm({ ...form, contactNumber: e.target.value })
                    }
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Timings</Label>
                  <Input
                    value={form.timings}
                    onChange={(e) =>
                      setForm({ ...form, timings: e.target.value })
                    }
                    placeholder="9 AM - 10 PM"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Google Maps Link</Label>
                <Input
                  value={form.mapLink}
                  onChange={(e) =>
                    setForm({ ...form, mapLink: e.target.value })
                  }
                  placeholder="https://maps.google.com/..."
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, isActive: checked })
                  }
                />
                <Label>Active</Label>
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Update Branch" : "Create Branch"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {branches.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
          <p className="text-sm text-muted-foreground">
            No branches yet. Add your first branch to get started.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell className="font-medium">{branch.name}</TableCell>
                  <TableCell>
                    {branch.city}, {branch.state}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {branch.contactNumber || "N/A"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        branch.isActive
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }
                      onClick={() => handleToggleActive(branch)}
                      role="button"
                    >
                      {branch.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(branch)}
                        aria-label="Edit branch"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(branch.id)}
                        aria-label="Delete branch"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
