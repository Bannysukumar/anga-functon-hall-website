"use client"

import { useEffect, useState } from "react"
import {
  createAuditLog,
  createWorkLocation,
  getBranches,
  getWorkLocations,
  updateWorkLocation,
} from "@/lib/firebase-db"
import type { Branch, WorkLocation } from "@/lib/types"
import { useAuth } from "@/lib/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2, Plus, Save } from "lucide-react"
import { toast } from "sonner"

export default function AdminWorkLocationsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [locations, setLocations] = useState<WorkLocation[]>([])
  const [form, setForm] = useState({
    name: "",
    address: "",
    lat: "",
    lng: "",
    radiusMeters: "100",
    branchId: "",
  })

  async function loadAll() {
    setLoading(true)
    try {
      const [branchData, locationData] = await Promise.all([
        getBranches(),
        getWorkLocations(),
      ])
      setBranches(branchData)
      setLocations(locationData)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function handleCreate() {
    if (!form.name || !form.branchId || !form.lat || !form.lng) {
      toast.error("Fill all required fields.")
      return
    }
    setCreating(true)
    try {
      const id = await createWorkLocation({
        name: form.name.trim(),
        address: form.address.trim(),
        geoPoint: {
          lat: Number(form.lat),
          lng: Number(form.lng),
        },
        radiusMeters: Number(form.radiusMeters) || 100,
        branchId: form.branchId,
        active: true,
      })
      try {
        await createAuditLog({
          entity: "workLocation",
          entityId: id,
          action: "CREATE",
          message: `Created work location ${form.name}`,
          payload: form,
          createdBy: user?.uid || "",
        })
      } catch {
        // Do not fail the main action if audit logging fails.
      }
      toast.success("Location created")
      setDialogOpen(false)
      setForm({
        name: "",
        address: "",
        lat: "",
        lng: "",
        radiusMeters: "100",
        branchId: "",
      })
      loadAll()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create location."
      toast.error(message)
    } finally {
      setCreating(false)
    }
  }

  async function handleSave(location: WorkLocation) {
    setSavingId(location.id)
    try {
      await updateWorkLocation(location.id, location)
      try {
        await createAuditLog({
          entity: "workLocation",
          entityId: location.id,
          action: "UPDATE",
          message: `Updated work location ${location.name}`,
          payload: location,
          createdBy: user?.uid || "",
        })
      } catch {
        // Do not fail the main action if audit logging fails.
      }
      toast.success("Location updated")
      loadAll()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update location."
      toast.error(message)
    } finally {
      setSavingId(null)
    }
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
          <h1 className="text-2xl font-bold text-foreground">Work Locations</h1>
          <p className="text-sm text-muted-foreground">
            Geo-fenced locations used for attendance marking.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Location
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Work Location</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Address</Label>
                <Input
                  value={form.address}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, address: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Branch</Label>
                <Select
                  value={form.branchId}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, branchId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Latitude</Label>
                  <Input
                    type="number"
                    value={form.lat}
                    onChange={(e) => setForm((prev) => ({ ...prev, lat: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Longitude</Label>
                  <Input
                    type="number"
                    value={form.lng}
                    onChange={(e) => setForm((prev) => ({ ...prev, lng: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Radius (meters)</Label>
                <Input
                  type="number"
                  value={form.radiusMeters}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, radiusMeters: e.target.value }))
                  }
                />
              </div>
              <Button onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Location
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {locations.map((location) => (
          <Card key={location.id}>
            <CardHeader>
              <CardTitle className="text-base">{location.name}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Name</Label>
                  <Input
                    value={location.name}
                    onChange={(e) =>
                      setLocations((prev) =>
                        prev.map((item) =>
                          item.id === location.id
                            ? { ...item, name: e.target.value }
                            : item
                        )
                      )
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Address</Label>
                  <Input
                    value={location.address}
                    onChange={(e) =>
                      setLocations((prev) =>
                        prev.map((item) =>
                          item.id === location.id
                            ? { ...item, address: e.target.value }
                            : item
                        )
                      )
                    }
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label>Latitude</Label>
                  <Input
                    type="number"
                    value={location.geoPoint.lat}
                    onChange={(e) =>
                      setLocations((prev) =>
                        prev.map((item) =>
                          item.id === location.id
                            ? {
                                ...item,
                                geoPoint: {
                                  ...item.geoPoint,
                                  lat: Number(e.target.value),
                                },
                              }
                            : item
                        )
                      )
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Longitude</Label>
                  <Input
                    type="number"
                    value={location.geoPoint.lng}
                    onChange={(e) =>
                      setLocations((prev) =>
                        prev.map((item) =>
                          item.id === location.id
                            ? {
                                ...item,
                                geoPoint: {
                                  ...item.geoPoint,
                                  lng: Number(e.target.value),
                                },
                              }
                            : item
                        )
                      )
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Radius (m)</Label>
                  <Input
                    type="number"
                    value={location.radiusMeters}
                    onChange={(e) =>
                      setLocations((prev) =>
                        prev.map((item) =>
                          item.id === location.id
                            ? {
                                ...item,
                                radiusMeters: Number(e.target.value),
                              }
                            : item
                        )
                      )
                    }
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={location.active}
                  onCheckedChange={(checked) =>
                    setLocations((prev) =>
                      prev.map((item) =>
                        item.id === location.id
                          ? { ...item, active: Boolean(checked) }
                          : item
                      )
                    )
                  }
                />
                Location active
              </label>
              <Button
                className="w-fit"
                onClick={() => handleSave(location)}
                disabled={savingId === location.id}
              >
                {savingId === location.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
