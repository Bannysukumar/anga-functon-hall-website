"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import type { Listing, Branch, ListingSlot, ListingAddon, ListingType } from "@/lib/types"
import {
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
  onSave: (
    data: Omit<Listing, "id" | "createdAt" | "updatedAt">,
    options?: { bulkRooms?: Array<{ roomNumber: string; roomId: string }> }
  ) => Promise<string>
  saving: boolean
  isEditMode?: boolean
}

const DEFAULT_LISTING = {
  roomId: "",
  roomNumber: "",
  floorNumber: 1,
  roomTypeDetail: "ac" as const,
  roomStatus: "available" as const,
  maxGuestCount: 100,
  totalBeds: 1,
  stageAvailable: false,
  decorationAllowed: true,
  groundArea: 0,
  outdoorAllowed: true,
  parkingAvailable: true,
  roomConfigurations: [] as NonNullable<Listing["roomConfigurations"]>,
  branchId: "",
  title: "",
  type: "function_hall" as ListingType,
  description: "",
  images: [] as string[],
  amenities: [] as string[],
  rules: [] as string[],
  capacity: 100,
  minGuestCount: 1,
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
  defaultCheckInTime: "09:00",
  defaultCheckOutTime: "18:00",
}

function buildFormState(initialData?: Listing) {
  if (!initialData) return DEFAULT_LISTING
  return {
    ...DEFAULT_LISTING,
    branchId: initialData.branchId || "",
    roomId: initialData.roomId || "",
    roomNumber: initialData.roomNumber || "",
    floorNumber: Number(initialData.floorNumber || 1),
    roomTypeDetail: initialData.roomTypeDetail || "ac",
    roomStatus: initialData.roomStatus || "available",
    maxGuestCount: initialData.maxGuestCount ?? initialData.capacity ?? DEFAULT_LISTING.maxGuestCount,
    totalBeds: initialData.totalBeds ?? initialData.inventory ?? DEFAULT_LISTING.totalBeds,
    stageAvailable: Boolean(initialData.stageAvailable),
    decorationAllowed:
      initialData.decorationAllowed === undefined
        ? DEFAULT_LISTING.decorationAllowed
        : Boolean(initialData.decorationAllowed),
    groundArea: Number(initialData.groundArea ?? DEFAULT_LISTING.groundArea),
    outdoorAllowed:
      initialData.outdoorAllowed === undefined
        ? DEFAULT_LISTING.outdoorAllowed
        : Boolean(initialData.outdoorAllowed),
    parkingAvailable:
      initialData.parkingAvailable === undefined
        ? DEFAULT_LISTING.parkingAvailable
        : Boolean(initialData.parkingAvailable),
    roomConfigurations: Array.isArray(initialData.roomConfigurations)
      ? initialData.roomConfigurations
      : [],
    title: initialData.title || "",
    type: initialData.type || DEFAULT_LISTING.type,
    description: initialData.description || "",
    images: Array.isArray(initialData.images) ? initialData.images : [],
    amenities: Array.isArray(initialData.amenities) ? initialData.amenities : [],
    rules: Array.isArray(initialData.rules) ? initialData.rules : [],
    capacity: initialData.capacity ?? DEFAULT_LISTING.capacity,
    minGuestCount: initialData.minGuestCount ?? DEFAULT_LISTING.minGuestCount,
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
    defaultCheckInTime:
      typeof initialData.defaultCheckInTime === "string" && initialData.defaultCheckInTime
        ? initialData.defaultCheckInTime
        : DEFAULT_LISTING.defaultCheckInTime,
    defaultCheckOutTime:
      typeof initialData.defaultCheckOutTime === "string" && initialData.defaultCheckOutTime
        ? initialData.defaultCheckOutTime
        : DEFAULT_LISTING.defaultCheckOutTime,
  }
}

const ADMIN_LISTING_TYPES: ListingType[] = [
  "room",
  "dining_hall",
  "dormitory",
  "open_function_hall",
  "function_hall",
]

function parseRoomTokens(raw: string) {
  return String(raw || "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .flatMap((token) => {
      const range = token.match(/^(\d+)\s*-\s*(\d+)$/)
      if (!range) return [token]
      const start = Number(range[1])
      const end = Number(range[2])
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return []
      const values: string[] = []
      for (let value = start; value <= end; value += 1) values.push(String(value))
      return values
    })
}

export function ListingForm({ initialData, onSave, saving, isEditMode = false }: ListingFormProps) {
  const router = useRouter()
  const [draftImageGroupId] = useState(
    () => `draft_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  )
  const [branches, setBranches] = useState<Branch[]>([])
  const [loadingBranches, setLoadingBranches] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [newRule, setNewRule] = useState("")
  const [acRoomNumbers, setAcRoomNumbers] = useState("")
  const [nonAcRoomNumbers, setNonAcRoomNumbers] = useState("")
  const [acRoomPrice, setAcRoomPrice] = useState(0)
  const [nonAcRoomPrice, setNonAcRoomPrice] = useState(0)
  const [acFloorNumber, setAcFloorNumber] = useState(1)
  const [nonAcFloorNumber, setNonAcFloorNumber] = useState(1)
  const [form, setForm] = useState(buildFormState(initialData))
  const [brokenImages, setBrokenImages] = useState<Record<number, boolean>>({})

  useEffect(() => {
    setForm(buildFormState(initialData))
    setBrokenImages({})
  }, [initialData])

  useEffect(() => {
    if (!initialData || initialData.type !== "room") return
    const configs = Array.isArray(initialData.roomConfigurations)
      ? initialData.roomConfigurations
      : []
    const acConfigs = configs.filter((entry) => entry.roomType !== "non_ac")
    const nonAcConfigs = configs.filter((entry) => entry.roomType === "non_ac")
    setAcRoomNumbers(acConfigs.map((entry) => String(entry.roomNumber)).join(","))
    setNonAcRoomNumbers(nonAcConfigs.map((entry) => String(entry.roomNumber)).join(","))
    setAcRoomPrice(Number(acConfigs[0]?.price || 0))
    setNonAcRoomPrice(Number(nonAcConfigs[0]?.price || 0))
    setAcFloorNumber(Math.max(1, Number(acConfigs[0]?.floorNumber || initialData.floorNumber || 1)))
    setNonAcFloorNumber(Math.max(1, Number(nonAcConfigs[0]?.floorNumber || initialData.floorNumber || 1)))
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
          initialData?.id || draftImageGroupId,
          file.name
        )
        const url = await uploadImage(file, path)
        urls.push(url)
      }
      setForm((prev) => ({ ...prev, images: [...prev.images, ...urls] }))
      toast.success(`${urls.length} image(s) uploaded`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upload images"
      toast.error(message)
      console.error("Listing image upload failed:", error)
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  function removeImage(index: number) {
    setForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }))
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
    if (!form.title) {
      toast.error("Title is required")
      return
    }
    if (form.type !== "room" && !form.pricePerUnit) {
      toast.error("Title and base price are required")
      return
    }
    if (form.originalPrice > 0 && form.originalPrice < form.pricePerUnit) {
      toast.error("Original price must be greater than or equal to offer price")
      return
    }
    if (form.minGuestCount < 1) {
      toast.error("Minimum guests must be at least 1")
      return
    }
    if (form.minGuestCount > form.capacity) {
      toast.error("Minimum guests cannot be greater than capacity")
      return
    }
    if (form.type === "room" && !String(form.roomId || "").trim()) {
      toast.error("Unique Room ID is required for room listings")
      return
    }
    if (form.type === "dormitory" && Number(form.inventory || 0) < 1) {
      toast.error("Total beds must be at least 1")
      return
    }
    const normalizedRoomId = String(form.roomId || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "-")
    const acRooms = parseRoomTokens(acRoomNumbers)
    const nonAcRooms = parseRoomTokens(nonAcRoomNumbers)
    const explicitRoomNumber = String(form.roomNumber || "").trim()

    let roomConfigurations: Listing["roomConfigurations"] = undefined
    if (form.type === "room") {
      const existingByRoomNumber = new Map(
        (form.roomConfigurations || []).map((entry) => [String(entry.roomNumber), entry])
      )
      const items: NonNullable<Listing["roomConfigurations"]> = []
      acRooms.forEach((roomNumber) => {
        if (Number(acRoomPrice || 0) > 0) {
          const existing = existingByRoomNumber.get(String(roomNumber))
          items.push({
            roomNumber,
            roomType: "ac",
            floorNumber: Math.max(1, Number(existing?.floorNumber || acFloorNumber || 1)),
            price: Math.max(0, Number(acRoomPrice || 0)),
            status: existing?.status || "available",
          })
        }
      })
      nonAcRooms.forEach((roomNumber) => {
        if (Number(nonAcRoomPrice || 0) > 0) {
          const existing = existingByRoomNumber.get(String(roomNumber))
          items.push({
            roomNumber,
            roomType: "non_ac",
            floorNumber: Math.max(1, Number(existing?.floorNumber || nonAcFloorNumber || 1)),
            price: Math.max(0, Number(nonAcRoomPrice || 0)),
            status: existing?.status || "available",
          })
        }
      })
      if (items.length === 0 && explicitRoomNumber) {
        items.push({
          roomNumber: explicitRoomNumber,
          roomType: form.roomTypeDetail === "non_ac" ? "non_ac" : "ac",
          floorNumber:
            form.roomTypeDetail === "non_ac"
              ? Math.max(1, Number(nonAcFloorNumber || form.floorNumber || 1))
              : Math.max(1, Number(acFloorNumber || form.floorNumber || 1)),
          price: Math.max(0, Number(form.pricePerUnit || 0)),
          status: "available",
        })
      }
      const unique = new Map<string, (typeof items)[number]>()
      items.forEach((item) => {
        unique.set(String(item.roomNumber).trim(), item)
      })
      roomConfigurations = Array.from(unique.values())
      if (roomConfigurations.length === 0) {
        toast.error("Provide at least one AC or Non-AC room number with price")
        return
      }
    }
    try {
      const fallbackPrice = Math.max(0, Number(form.pricePerUnit || 0))
      const minRoomPrice =
        roomConfigurations && roomConfigurations.length > 0
          ? Math.min(...roomConfigurations.map((entry) => Number(entry.price || 0)))
          : fallbackPrice
      await onSave({
        ...(form as Omit<Listing, "id" | "createdAt" | "updatedAt">),
        roomId: normalizedRoomId,
        roomNumber:
          roomConfigurations && roomConfigurations.length > 0
            ? String(roomConfigurations[0].roomNumber || "")
            : explicitRoomNumber,
        roomConfigurations,
        inventory:
          roomConfigurations && roomConfigurations.length > 0
            ? roomConfigurations.length
            : form.inventory,
        pricePerUnit: form.type === "room" ? minRoomPrice : form.pricePerUnit,
        totalBeds: form.type === "dormitory" ? Math.max(1, Number(form.inventory || 1)) : undefined,
      })
      router.replace("/admin/listings")
      router.refresh()
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
                  {ADMIN_LISTING_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {LISTING_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.type === "room" && (
            <div className="flex flex-col gap-2">
              <Label>Unique Room ID *</Label>
              <Input
                value={form.roomId}
                onChange={(e) => setForm({ ...form, roomId: e.target.value })}
                placeholder="ROOM-101"
              />
              <p className="text-xs text-muted-foreground">
                Use one Room ID base. Bulk mode appends room number automatically.
              </p>
            </div>
          )}
          {form.type === "room" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Room Number {isEditMode ? "*" : "(optional in bulk mode)"}</Label>
                <Input
                  value={form.roomNumber}
                  onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
                  placeholder="101"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Room Type *</Label>
                <Select
                  value={form.roomTypeDetail}
                  onValueChange={(v) =>
                    setForm({ ...form, roomTypeDetail: v as "ac" | "non_ac" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ac">AC</SelectItem>
                    <SelectItem value="non_ac">Non AC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Default Floor Number *</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.floorNumber}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      floorNumber: Math.max(1, Number(e.target.value || 1)),
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Room Status</Label>
                <Select
                  value={form.roomStatus}
                  onValueChange={(value) =>
                    setForm({
                      ...form,
                      roomStatus: value as "available" | "blocked" | "maintenance",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>AC Room Numbers</Label>
                <Input
                  value={acRoomNumbers}
                  onChange={(e) => setAcRoomNumbers(e.target.value)}
                  placeholder="101,102,103 or 101-120"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>AC Floor Number</Label>
                <Input
                  type="number"
                  min={1}
                  value={acFloorNumber}
                  onChange={(e) => setAcFloorNumber(Math.max(1, Number(e.target.value || 1)))}
                  placeholder="1"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>AC Room Price</Label>
                <Input
                  type="number"
                  min={0}
                  value={acRoomPrice}
                  onChange={(e) => setAcRoomPrice(Number(e.target.value || 0))}
                  placeholder="1999"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Non-AC Room Numbers</Label>
                <Input
                  value={nonAcRoomNumbers}
                  onChange={(e) => setNonAcRoomNumbers(e.target.value)}
                  placeholder="201,202,203 or 201-220"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Non-AC Floor Number</Label>
                <Input
                  type="number"
                  min={1}
                  value={nonAcFloorNumber}
                  onChange={(e) => setNonAcFloorNumber(Math.max(1, Number(e.target.value || 1)))}
                  placeholder="2"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Non-AC Room Price</Label>
                <Input
                  type="number"
                  min={0}
                  value={nonAcRoomPrice}
                  onChange={(e) => setNonAcRoomPrice(Number(e.target.value || 0))}
                  placeholder="1499"
                />
              </div>
            </div>
          )}
          {form.type === "room" && Array.isArray(form.roomConfigurations) && form.roomConfigurations.length > 0 && (
            <div className="rounded-md border bg-secondary/30 p-3 text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">Configured Rooms Preview</p>
              <p>
                AC: {form.roomConfigurations.filter((entry) => entry.roomType !== "non_ac").length} | Non-AC:{" "}
                {form.roomConfigurations.filter((entry) => entry.roomType === "non_ac").length}
              </p>
              <p className="line-clamp-2">
                {form.roomConfigurations.map((entry) => `${entry.roomNumber}(${entry.roomType === "non_ac" ? "Non-AC" : "AC"})`).join(", ")}
              </p>
            </div>
          )}
          {form.type === "dormitory" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Total Beds *</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.inventory}
                  onChange={(e) =>
                    setForm({ ...form, inventory: Math.max(1, Number(e.target.value || 1)) })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Room Type *</Label>
                <Select
                  value={form.roomTypeDetail}
                  onValueChange={(v) =>
                    setForm({ ...form, roomTypeDetail: v as "ac" | "non_ac" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ac">AC</SelectItem>
                    <SelectItem value="non_ac">Non AC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Floor Number *</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.floorNumber}
                  onChange={(e) =>
                    setForm({ ...form, floorNumber: Math.max(1, Number(e.target.value || 1)) })
                  }
                />
              </div>
            </div>
          )}
          {form.type === "function_hall" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label>Stage Available</Label>
                <Switch
                  checked={Boolean(form.stageAvailable)}
                  onCheckedChange={(checked) => setForm({ ...form, stageAvailable: checked })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label>Decoration Allowed</Label>
                <Switch
                  checked={Boolean(form.decorationAllowed)}
                  onCheckedChange={(checked) => setForm({ ...form, decorationAllowed: checked })}
                />
              </div>
            </div>
          )}
          {form.type === "open_function_hall" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Ground Area (sq.ft)</Label>
                <Input
                  type="number"
                  min={0}
                  value={Number(form.groundArea || 0)}
                  onChange={(e) => setForm({ ...form, groundArea: Math.max(0, Number(e.target.value || 0)) })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label>Outdoor Allowed</Label>
                <Switch
                  checked={Boolean(form.outdoorAllowed)}
                  onCheckedChange={(checked) => setForm({ ...form, outdoorAllowed: checked })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label>Parking Available</Label>
                <Switch
                  checked={Boolean(form.parkingAvailable)}
                  onCheckedChange={(checked) => setForm({ ...form, parkingAvailable: checked })}
                />
              </div>
            </div>
          )}
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
              <Label>
                {form.type === "dormitory" ? "Dormitory Capacity (beds)" : "Capacity (guests)"}
              </Label>
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
              <Label>Minimum Guests Allowed</Label>
              <Input
                type="number"
                min={1}
                max={form.capacity}
                value={form.minGuestCount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    minGuestCount: parseInt(e.target.value) || 1,
                  })
                }
              />
            </div>
          </div>
          {(form.type === "dining_hall" || form.type === "function_hall" || form.type === "open_function_hall") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Maximum Guests Allowed</Label>
                <Input
                  type="number"
                  min={1}
                  value={Number(form.maxGuestCount || form.capacity || 1)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      maxGuestCount: Math.max(1, Number(e.target.value || 1)),
                    })
                  }
                />
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>
                {form.type === "dormitory"
                  ? "Inventory (auto from total beds)"
                  : "Inventory (units/rooms/beds)"}
              </Label>
              <Input
                type="number"
                min={1}
                value={form.inventory}
                disabled={form.type === "dormitory"}
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

      {/* Check-in & Check-out timing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Check-in & Check-out timing</CardTitle>
          <p className="text-sm text-muted-foreground">
            Default times used when creating bookings for this listing. Guests can check in from the check-in time and must check out by the check-out time on the event date.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Default check-in time</Label>
              <Input
                type="time"
                value={form.defaultCheckInTime}
                onChange={(e) =>
                  setForm({ ...form, defaultCheckInTime: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Default check-out time</Label>
              <Input
                type="time"
                value={form.defaultCheckOutTime}
                onChange={(e) =>
                  setForm({ ...form, defaultCheckOutTime: e.target.value })
                }
              />
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
            <Label>
              {form.type === "room" || form.type === "dormitory"
                ? "Base Price (per 24 hours) *"
                : "Base Price (per unit) *"}
            </Label>
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
            {(form.type === "room" || form.type === "dormitory") && (
              <p className="text-xs text-muted-foreground">
                Billing uses check-in to check-out duration in 24-hour units.
              </p>
            )}
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
