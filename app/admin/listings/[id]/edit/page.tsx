"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { getListing, updateListing } from "@/lib/firebase-db"
import type { Listing } from "@/lib/types"
import { ListingForm } from "@/components/admin/listing-form"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"

export default function EditListingPage() {
  const params = useParams()
  const id = params.id as string
  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const data = await getListing(id)
        setListing(data)
      } catch {
        toast.error("Failed to load listing")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function handleSave(
    data: Omit<Listing, "id" | "createdAt" | "updatedAt">
  ) {
    setSaving(true)
    try {
      await updateListing(id, data)
      toast.success("Listing updated successfully")
      return id
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Listing not found</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Edit Listing</h1>
        <p className="text-sm text-muted-foreground">
          Update listing details
        </p>
      </div>
      <ListingForm initialData={listing} onSave={handleSave} saving={saving} isEditMode />
    </div>
  )
}
