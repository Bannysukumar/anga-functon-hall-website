"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/lib/hooks/use-auth"
import { getSettings, updateSettings } from "@/lib/firebase-db"
import { getBannerImagePath, uploadImage } from "@/lib/firebase-storage"
import type { HeroBanner, SiteSettings } from "@/lib/types"
import { DEFAULT_SETTINGS } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { GripVertical, Plus, Save, Trash2, Upload } from "lucide-react"

function normalizeHeroImages(items: HeroBanner[] | undefined) {
  const list = Array.isArray(items) ? items : []
  const normalized = list
    .map((item, index) => ({
      imageUrl: String(item?.imageUrl || "").trim(),
      title: String(item?.title || `Hero Image ${index + 1}`).trim(),
      subtitle: String(item?.subtitle || "").trim(),
      isActive: item?.isActive !== false,
      order: Number.isFinite(Number(item?.order)) ? Number(item?.order) : index,
      uploadedAt: String(item?.uploadedAt || ""),
    }))
    .sort((a, b) => a.order - b.order)

  if (normalized.length > 0) {
    return normalized.map((item, index) => ({ ...item, order: index }))
  }

  return DEFAULT_SETTINGS.heroBanners.map((item, index) => ({
    imageUrl: String(item.imageUrl || "").trim(),
    title: String(item.title || `Hero Image ${index + 1}`).trim(),
    subtitle: String(item.subtitle || "").trim(),
    isActive: item.isActive !== false,
    order: index,
    uploadedAt: item.uploadedAt || "",
  }))
}

export default function HeroImagesPage() {
  const { user, hasAnyPermission, isAdminUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)
  const [images, setImages] = useState<HeroBanner[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const canManage = isAdminUser || hasAnyPermission(["CMS_EDIT"])

  useEffect(() => {
    let mounted = true
    getSettings()
      .then((settings) => {
        if (!mounted) return
        setImages(normalizeHeroImages(settings.heroBanners))
      })
      .catch(() => {
        if (mounted) setImages(normalizeHeroImages(DEFAULT_SETTINGS.heroBanners))
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const activeCount = useMemo(
    () => images.filter((image) => image.isActive !== false && image.imageUrl).length,
    [images]
  )

  function updateImage(index: number, patch: Partial<HeroBanner>) {
    setImages((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    )
  }

  function addImage() {
    setImages((prev) => [
      ...prev,
      {
        imageUrl: "",
        title: `Hero Image ${prev.length + 1}`,
        subtitle: "",
        isActive: true,
        order: prev.length,
        uploadedAt: new Date().toISOString(),
      },
    ])
  }

  function removeImage(index: number) {
    setImages((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((item, i) => ({ ...item, order: i }))
    )
  }

  function reorder(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return
    setImages((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next.map((item, index) => ({ ...item, order: index }))
    })
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>, index: number) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a valid image file.")
      return
    }
    setUploadingIndex(index)
    try {
      const path = getBannerImagePath(file.name)
      const imageUrl = await uploadImage(file, path)
      updateImage(index, { imageUrl, uploadedAt: new Date().toISOString(), isActive: true })
      toast.success("Hero image uploaded")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setUploadingIndex(null)
      event.target.value = ""
    }
  }

  async function handleSave() {
    if (!canManage) {
      toast.error("You do not have permission to manage hero images.")
      return
    }
    setSaving(true)
    try {
      const payload = normalizeHeroImages(images)
      await updateSettings({ heroBanners: payload } as Partial<SiteSettings>)
      setImages(payload)
      toast.success("Hero images saved successfully")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save hero images")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading hero images...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Hero Images</h1>
        <p className="text-sm text-muted-foreground">
          Manage homepage hero background slider images.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Homepage Slider Images</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Active images: {activeCount}. Slider rotates every 5 seconds.
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={addImage}>
              <Plus className="mr-1 h-4 w-4" />
              Add Image
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving || !canManage}>
              <Save className="mr-1 h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {images.map((image, index) => (
            <div
              key={`${image.imageUrl}-${index}`}
              className="rounded-lg border bg-card p-3"
              draggable={canManage}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) reorder(dragIndex, index)
                setDragIndex(null)
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <GripVertical className="h-3.5 w-3.5" />
                  Drag to reorder
                </div>
                <Badge variant={image.isActive !== false ? "default" : "secondary"}>
                  {image.isActive !== false ? "Active" : "Disabled"}
                </Badge>
              </div>

              {image.imageUrl ? (
                <img
                  src={image.imageUrl}
                  alt={image.title || `Hero image ${index + 1}`}
                  className="h-36 w-full rounded object-cover"
                />
              ) : (
                <div className="flex h-36 w-full items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
                  No image
                </div>
              )}

              <div className="mt-3 space-y-2">
                <Label className="text-xs">Title</Label>
                <Input
                  value={image.title}
                  onChange={(event) => updateImage(index, { title: event.target.value })}
                  placeholder="Image title"
                />
              </div>

              <div className="mt-2 flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={image.isActive !== false}
                    onCheckedChange={(checked) =>
                      updateImage(index, { isActive: Boolean(checked) })
                    }
                  />
                  Enable image
                </label>
                <span className="text-[11px] text-muted-foreground">
                  {image.uploadedAt ? new Date(image.uploadedAt).toLocaleDateString("en-IN") : "Not uploaded"}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <label>
                  <Input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => handleUpload(event, index)}
                    disabled={uploadingIndex === index || !canManage}
                  />
                  <Button type="button" variant="outline" className="w-full" disabled={uploadingIndex === index || !canManage} asChild>
                    <span>
                      <Upload className="mr-1 h-4 w-4" />
                      {uploadingIndex === index ? "Uploading..." : "Upload"}
                    </span>
                  </Button>
                </label>
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  onClick={() => removeImage(index)}
                  disabled={images.length <= 1 || !canManage}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

