"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import type { Listing, Branch, ListingSlot, ListingAddon, ListingType } from "@/lib/types"
import {
  LISTING_TYPES,
  LISTING_TYPE_LABELS,
  AMENITY_OPTIONS,
} from "@/lib/constants"
import { getBranches } from "@/lib/firebase-db"
import { uploadImage, getListingImagePath } from "@/lib/firebase-storage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { Plus, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

interface ListingFormProps {
  initialData?: Listing
  onSave: (data: Omit<Listing, "id" | "createdAt" | "updatedAt">) => Promise<string>
  saving: boolean
}

const DEFAULT_LISTING = {
  branchId: "",
  title: "",
  type: "function_hall" as ListingType,
  description: "",
  images: [] as string[],
  amenities: [] as string[],
  rules: [] as string[],
  capacity: 100,
  inventory: 1,
  pricePerUnit: 0,
  originalPrice: 0,
  slotsEnabled: false,
  slots: [] as ListingSlot[],
  paymentMode: "full" as const,
  advanceAmount: 0,
  cancellationPolicy: "free" as const,
  freeCancelHours: 48,
  partialRefundPercent: 50,
  addons: [] as ListingAddon[],
  isActive: true,
  isFeatured: false,
}

function buildFormState(initialData?: Listing) {
  if (!initialData) return DEFAULT_LISTING
  return {
    ...DEFAULT_LISTING,
    branchId: initialData.branchId || "",
    title: initialData.title || "",
    type: initialData.type || DEFAULT_LISTING.type,
    description: initialData.description || "",
    images: Array.isArray(initialData.images) ? initialData.images : [],
    amenities: Array.isArray(initialData.amenities) ? initialData.amenities : [],
    rules: Array.isArray(initialData.rules) ? initialData.rules : [],
    capacity: initialData.capacity ?? DEFAULT_LISTING.capacity,
    inventory: initialData.inventory ?? DEFAULT_LISTING.inventory,
    pricePerUnit: initialData.pricePerUnit ?? DEFAULT_LISTING.pricePerUnit,
    originalPrice: initialData.originalPrice ?? DEFAULT_LISTING.originalPrice,
    slotsEnabled: Boolean(initialData.slotsEnabled),
    slots: Array.isArray(initialData.slots) ? initialData.slots : [],
    paymentMode: initialData.paymentMode || DEFAULT_LISTING.paymentMode,
    advanceAmount: initialData.advanceAmount ?? DEFAULT_LISTING.advanceAmount,
    cancellationPolicy:
      initialData.cancellationPolicy || DEFAULT_LISTING.cancellationPolicy,
    freeCancelHours: initialData.freeCancelHours ?? DEFAULT_LISTING.freeCancelHours,
    partialRefundPercent:
      initialData.partialRefundPercent ?? DEFAULT_LISTING.partialRefundPercent,
    addons: Array.isArray(initialData.addons) ? initialData.addons : [],
    isActive: initialData.isActive ?? DEFAULT_LISTING.isActive,
    isFeatured: initialData.isFeatured ?? DEFAULT_LISTING.isFeatured,
  }
}

export function ListingForm({ initialData, onSave, saving }: ListingFormProps) {
  const router = useRouter()
  const [branches, setBranches] = useState<Branch[]>([])
  const [loadingBranches, setLoadingBranches] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [newRule, setNewRule] = useState("")
  const [form, setForm] = useState(buildFormState(initialData))
  const [brokenImages, setBrokenImages] = useState<Record<number, boolean>>({})

  useEffect(() => {
    setForm(buildFormState(initialData))
    setBrokenImages({})
  }, [initialData])

  useEffect(() => {
    async function load() {
      try {
        const data = await getBranches(initialData ? false : true)
        setBranches(data)
      } catch {
        toast.error("Failed to load branches")
      } finally {
        setLoadingBranches(false)
      }
    }
    load()
  }, [initialData])

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const urls: string[] = []
      for (const file of Array.from(files)) {
        const path = getListingImagePath(
          initialData?.id || "new",
          file.name
        )
        const url = await uploadImage(file, path)
        urls.push(url)
      }
      setForm({ ...form, images: [...form.images, ...urls] })
      toast.success(`${urls.length} image(s) uploaded`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upload images"
      toast.error(message)
      console.error("Listing image upload failed:", error)
    } finally {
      setUploading(false)
    }
  }

  function removeImage(index: number) {
    setForm({ ...form, images: form.images.filter((_, i) => i !== index) })
  }

  function addSlot() {
    setForm({
      ...form,
      slots: [
        ...form.slots,
        {
          slotId: `slot_${Date.now()}`,
          name: `Slot ${form.slots.length + 1}`,
          startTime: "09:00",
          endTime: "13:00",
          price: form.pricePerUnit,
        },
      ],
    })
  }

  function updateSlot(index: number, field: keyof ListingSlot, value: string | number) {
    const updated = [...form.slots]
    updated[index] = { ...updated[index], [field]: value }
    setForm({ ...form, slots: updated })
  }

  function removeSlot(index: number) {
    setForm({ ...form, slots: form.slots.filter((_, i) => i !== index) })
  }

  function addAddon() {
    setForm({
      ...form,
      addons: [
        ...form.addons,
        { name: "", type: "fixed" as const, price: 0 },
      ],
    })
  }

  function updateAddon(index: number, field: keyof ListingAddon, value: string | number) {
    const updated = [...form.addons]
    updated[index] = { ...updated[index], [field]: value }
    setForm({ ...form, addons: updated })
  }

  function removeAddon(index: number) {
    setForm({ ...form, addons: form.addons.filter((_, i) => i !== index) })
  }

  function toggleAmenity(amenity: string) {
    setForm({
      ...form,
      amenities: form.amenities.includes(amenity)
        ? form.amenities.filter((a) => a !== amenity)
        : [...form.amenities, amenity],
    })
  }

  function addRule() {
    if (!newRule.trim()) return
    setForm({ ...form, rules: [...form.rules, newRule.trim()] })
    setNewRule("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.pricePerUnit) {
      toast.error("Title and base price are required")
      return
    }
    if (form.originalPrice > 0 && form.originalPrice < form.pricePerUnit) {
      toast.error("Original price must be greater than or equal to offer price")
      return
    }
    try {
      await onSave(form as Omit<Listing, "id" | "createdAt" | "updatedAt">)
      router.push("/admin/listings")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save listing")
    }
  }

  if (loadingBranches) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Grand Banquet Hall"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Type *</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm({ ...form, type: v as ListingType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LISTING_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {LISTING_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Branch</Label>
            <Select
              value={form.branchId}
              onValueChange={(v) => setForm({ ...form, branchId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} - {b.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={4}
              placeholder="Describe this listing..."
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Capacity (guests)</Label>
              <Input
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) =>
                  setForm({
                    ...form,
                    capacity: parseInt(e.target.value) || 1,
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Inventory (units/rooms/beds)</Label>
              <Input
                type="number"
                min={1}
                value={form.inventory}
                onChange={(e) =>
                  setForm({
                    ...form,
                    inventory: parseInt(e.target.value) || 1,
                  })
                }
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(c) => setForm({ ...form, isActive: c })}
              />
              <Label>Active</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isFeatured}
                onCheckedChange={(c) => setForm({ ...form, isFeatured: c })}
              />
              <Label>Featured</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Images */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Images</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {form.images.map((url, i) => (
              <div key={i} className="group relative aspect-video overflow-hidden rounded-lg border">
                {!brokenImages[i] ? (
                  <img
                    src={url}
                    alt={`Listing image ${i + 1}`}
                    className="h-full w-full object-cover"
                    onError={() =>
                      setBrokenImages((prev) => ({ ...prev, [i]: true }))
                    }
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-muted">
                    <span className="text-xs text-muted-foreground">Image unavailable</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute right-1 top-1 rounded-full bg-destructive/90 p-1 text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Remove image"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <Label
            htmlFor="image-upload"
            className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            {uploading ? (
              <Spinner className="h-5 w-5" />
            ) : (
              <Upload className="h-5 w-5" />
            )}
            <span className="text-sm">
              {uploading ? "Uploading..." : "Click to upload images"}
            </span>
          </Label>
          <input
            id="image-upload"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageUpload}
            disabled={uploading}
          />
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pricing</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Base Price (per unit) *</Label>
            <Input
              type="number"
              min={0}
              value={form.pricePerUnit}
              onChange={(e) =>
                setForm({
                  ...form,
                  pricePerUnit: parseFloat(e.target.value) || 0,
                })
              }
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Original Price (for offer display)</Label>
            <Input
              type="number"
              min={0}
              value={form.originalPrice || 0}
              onChange={(e) =>
                setForm({
                  ...form,
                  originalPrice: parseFloat(e.target.value) || 0,
                })
              }
              placeholder="Optional MRP/original price"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Payment Mode</Label>
              <Select
                value={form.paymentMode}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    paymentMode: v as "full" | "advance_fixed" | "advance_percent",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Payment</SelectItem>
                  <SelectItem value="advance_fixed">
                    Advance (Fixed Amount)
                  </SelectItem>
                  <SelectItem value="advance_percent">
                    Advance (Percentage)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.paymentMode !== "full" && (
              <div className="flex flex-col gap-2">
                <Label>
                  Advance Amount{" "}
                  {form.paymentMode === "advance_percent" ? "(%)" : "(INR)"}
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={form.advanceAmount}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      advanceAmount: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Time Slots */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Time Slots</CardTitle>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.slotsEnabled}
              onCheckedChange={(c) =>
                setForm({ ...form, slotsEnabled: c })
              }
            />
            <Label className="text-sm">Enable Slots</Label>
          </div>
        </CardHeader>
        {form.slotsEnabled && (
          <CardContent className="flex flex-col gap-3">
            {form.slots.map((slot, i) => (
              <div
                key={slot.slotId}
                className="flex items-end gap-3 rounded-lg border p-3"
              >
                <div className="flex flex-1 flex-col gap-2">
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={slot.name}
                    onChange={(e) => updateSlot(i, "name", e.target.value)}
                    placeholder="Morning Slot"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs">Start</Label>
                  <Input
                    type="time"
                    value={slot.startTime}
                    onChange={(e) =>
                      updateSlot(i, "startTime", e.target.value)
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs">End</Label>
                  <Input
                    type="time"
                    value={slot.endTime}
                    onChange={(e) =>
                      updateSlot(i, "endTime", e.target.value)
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs">Price</Label>
                  <Input
                    type="number"
                    min={0}
                    value={slot.price}
                    onChange={(e) =>
                      updateSlot(i, "price", parseFloat(e.target.value) || 0)
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSlot(i)}
                  className="text-destructive shrink-0"
                  aria-label="Remove slot"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addSlot}>
              <Plus className="mr-2 h-4 w-4" />
              Add Slot
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Add-ons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add-ons</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {form.addons.map((addon, i) => (
            <div
              key={i}
              className="flex items-end gap-3 rounded-lg border p-3"
            >
              <div className="flex flex-1 flex-col gap-2">
                <Label className="text-xs">Name</Label>
                <Input
                  value={addon.name}
                  onChange={(e) => updateAddon(i, "name", e.target.value)}
                  placeholder="Decoration"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-xs">Type</Label>
                <Select
                  value={addon.type}
                  onValueChange={(v) => updateAddon(i, "type", v)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="per_person">Per Person</SelectItem>
                    <SelectItem value="per_hour">Per Hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-xs">Price</Label>
                <Input
                  type="number"
                  min={0}
                  value={addon.price}
                  onChange={(e) =>
                    updateAddon(i, "price", parseFloat(e.target.value) || 0)
                  }
                  className="w-24"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeAddon(i)}
                className="text-destructive shrink-0"
                aria-label="Remove add-on"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addAddon}>
            <Plus className="mr-2 h-4 w-4" />
            Add Add-on
          </Button>
        </CardContent>
      </Card>

      {/* Cancellation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cancellation Policy</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label>Policy</Label>
            <Select
              value={form.cancellationPolicy}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  cancellationPolicy: v as "free" | "partial" | "non_refundable",
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free Cancellation</SelectItem>
                <SelectItem value="partial">Partial Refund</SelectItem>
                <SelectItem value="non_refundable">Non-refundable</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.cancellationPolicy === "free" && (
            <div className="flex flex-col gap-2">
              <Label>Free Cancel Window (hours)</Label>
              <Input
                type="number"
                min={0}
                value={form.freeCancelHours}
                onChange={(e) =>
                  setForm({
                    ...form,
                    freeCancelHours: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
          )}
          {form.cancellationPolicy === "partial" && (
            <div className="flex flex-col gap-2">
              <Label>Refund (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.partialRefundPercent}
                onChange={(e) =>
                  setForm({
                    ...form,
                    partialRefundPercent: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Amenities */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Amenities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {AMENITY_OPTIONS.map((amenity) => (
              <label
                key={amenity}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <Checkbox
                  checked={form.amenities.includes(amenity)}
                  onCheckedChange={() => toggleAmenity(amenity)}
                />
                {amenity}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rules & Policies</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {form.rules.map((rule, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex-1 text-sm text-foreground">{rule}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() =>
                  setForm({
                    ...form,
                    rules: form.rules.filter((_, idx) => idx !== i),
                  })
                }
                className="text-destructive shrink-0"
                aria-label="Remove rule"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={newRule}
              onChange={(e) => setNewRule(e.target.value)}
              placeholder="Add a rule..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addRule()
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addRule}>
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/listings")}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving
            ? "Saving..."
            : initialData
              ? "Update Listing"
              : "Create Listing"}
        </Button>
      </div>
    </form>
  )
}
