"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { useAuth } from "@/lib/hooks/use-auth"
import type { GalleryItem } from "@/lib/types"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import { Upload, MoreHorizontal, Pencil, Trash2, ImagePlus } from "lucide-react"
import { uploadImage, getGalleryImagePath } from "@/lib/firebase-storage"
import { toast } from "sonner"

type AdminGalleryItem = Omit<GalleryItem, "createdAt" | "updatedAt"> & {
  createdAt?: string | null
  updatedAt?: string | null
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB hard cap
const TARGET_MAX_BYTES = 350 * 1024 // aim for ~350 KB after compression
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"]

export default function AdminGalleryPage() {
  const { user, hasPermission, isAdminUser } = useAuth()
  const [items, setItems] = useState<AdminGalleryItem[]>([])
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AdminGalleryItem | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<AdminGalleryItem | null>(
    null
  )
  const [deleting, setDeleting] = useState(false)

  const canManage = useMemo(
    () => Boolean(user) && (isAdminUser || hasPermission("CMS_EDIT")),
    [user, isAdminUser, hasPermission]
  )

  useEffect(() => {
    if (!user || !canManage) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const token = await user.getIdToken()
        const res = await fetch("/api/admin/gallery", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        const data = (await res.json()) as { items?: AdminGalleryItem[] }
        if (!cancelled && Array.isArray(data.items)) {
          setItems(data.items)
        }
      } catch (err) {
        console.error("Failed to load gallery items", err)
        if (!cancelled) {
          toast.error("Failed to load gallery items.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user, canManage])

  const resetForm = () => {
    setEditingItem(null)
    setTitle("")
    setDescription("")
    setFile(null)
    setUploadProgress(0)
  }

  const openCreateDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEditDialog = (item: AdminGalleryItem) => {
    setEditingItem(item)
    setTitle(item.title || "")
    setDescription(item.description || "")
    setFile(null)
    setUploadProgress(0)
    setDialogOpen(true)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0]
    if (!selected) {
      setFile(null)
      return
    }

    if (!ACCEPTED_TYPES.includes(selected.type)) {
      toast.error("Please upload a JPG, PNG or WebP image.")
      event.target.value = ""
      return
    }
    if (selected.size > MAX_FILE_SIZE_BYTES) {
      toast.error("Image is too large. Maximum size is 5 MB.")
      event.target.value = ""
      return
    }

    setFile(selected)
  }

  async function compressImageIfNeeded(file: File): Promise<File> {
    // For small files, skip compression
    if (file.size <= TARGET_MAX_BYTES) return file

    try {
      const imageBitmap = await createImageBitmap(file)
      const maxDimension = 1600
      let { width, height } = imageBitmap
      if (width > height && width > maxDimension) {
        height = Math.round((height * maxDimension) / width)
        width = maxDimension
      } else if (height >= width && height > maxDimension) {
        width = Math.round((width * maxDimension) / height)
        height = maxDimension
      }

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) return file
      ctx.drawImage(imageBitmap, 0, 0, width, height)

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(
          (b) => resolve(b),
          file.type === "image/png" ? "image/png" : "image/webp",
          0.8
        )
      )
      if (!blob) return file
      const compressedFile = new File([blob], file.name, { type: blob.type })
      return compressedFile.size < file.size ? compressedFile : file
    } catch {
      return file
    }
  }

  const handleSave = async () => {
    if (!user) {
      toast.error("You must be signed in.")
      return
    }
    if (!title.trim()) {
      toast.error("Title is required.")
      return
    }
    if (!editingItem && !file) {
      toast.error("Please select an image to upload.")
      return
    }

    setSaving(true)
    try {
      const token = await user.getIdToken()
      let imageUrl = editingItem?.imageUrl || ""
      let storagePath = editingItem?.storagePath || ""

      if (file) {
        const optimizedFile = await compressImageIfNeeded(file)
        const path = getGalleryImagePath(optimizedFile.name)
        setUploadProgress(0)
        imageUrl = await uploadImage(optimizedFile, path, (progress) =>
          setUploadProgress(progress)
        )
        storagePath = path
      }

      if (editingItem) {
        const res = await fetch(`/api/admin/gallery/${editingItem.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            imageUrl: file ? imageUrl : undefined,
            storagePath: file ? storagePath : undefined,
          }),
        })
        if (!res.ok) {
          const body = (await res.json()) as { error?: string }
          throw new Error(body.error || "Failed to update image.")
        }
        const updated = (await res.json()) as AdminGalleryItem
        setItems((prev) =>
          prev.map((it) => (it.id === updated.id ? updated : it))
        )
        toast.success("Image updated.")
      } else {
        const res = await fetch("/api/admin/gallery", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            imageUrl,
            storagePath,
          }),
        })
        if (!res.ok) {
          const body = (await res.json()) as { error?: string }
          throw new Error(body.error || "Failed to create image.")
        }
        const created = (await res.json()) as AdminGalleryItem
        setItems((prev) => [created, ...prev])
        toast.success("Image added to gallery.")
      }

      setDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Failed to save gallery image", error)
      toast.error(
        error instanceof Error ? error.message : "Failed to save gallery image."
      )
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!user || !deleteTarget) return
    setDeleting(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch(`/api/admin/gallery/${deleteTarget.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error || "Failed to delete image.")
      }
      setItems((prev) => prev.filter((it) => it.id !== deleteTarget.id))
      toast.success("Image deleted.")
      setDeleteTarget(null)
    } catch (error) {
      console.error("Failed to delete gallery image", error)
      toast.error(
        error instanceof Error ? error.message : "Failed to delete image."
      )
    } finally {
      setDeleting(false)
    }
  }

  if (!user || !canManage) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">
          You do not have permission to manage the gallery.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
            Gallery
          </h1>
          <p className="text-sm text-muted-foreground">
            Upload and manage images shown on the public gallery page.
          </p>
        </div>
        <Button onClick={openCreateDialog} size="sm">
          <ImagePlus className="mr-2 h-4 w-4" />
          Add Image
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base font-semibold">
            Gallery Images
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <Spinner className="h-6 w-6" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm font-medium text-foreground">
                No images in gallery yet.
              </p>
              <p className="max-w-md text-xs text-muted-foreground">
                Use the &quot;Add Image&quot; button above to upload your first
                gallery image.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {items.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  <div className="relative aspect-[4/3] w-full bg-muted">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.title || "Gallery image"}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        No image
                      </div>
                    )}
                  </div>
                  <CardContent className="flex flex-col gap-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-1 flex-col gap-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.title || "Untitled image"}
                        </p>
                        {item.description && (
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {item.description}
                          </p>
                        )}
                        {item.createdAt && (
                          <Badge
                            variant="outline"
                            className="mt-1 w-fit text-[10px] font-normal text-muted-foreground"
                          >
                            {new Date(
                              item.createdAt
                            ).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </Badge>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openEditDialog(item)}>
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(item)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Image" : "Add Image"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="E.g. Main Hall Decoration"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description about this photo."
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="image">Image file</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Accepted types: JPG, PNG, WebP. Max size: 5 MB.
              </p>
              {uploadProgress > 0 && uploadProgress < 100 && (
                <p className="text-xs text-muted-foreground">
                  Uploading... {uploadProgress.toFixed(0)}%
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDialogOpen(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Saving...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Save
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete image?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the image from the gallery and delete
              the file from storage. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

