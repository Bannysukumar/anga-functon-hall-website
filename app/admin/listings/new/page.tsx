"use client"

import { useState } from "react"
import { createListing } from "@/lib/firebase-db"
import type { Listing } from "@/lib/types"
import { ListingForm } from "@/components/admin/listing-form"
import { toast } from "sonner"

export default function NewListingPage() {
  const [saving, setSaving] = useState(false)

  async function handleSave(
    data: Omit<Listing, "id" | "createdAt" | "updatedAt">
  ) {
    setSaving(true)
    try {
      await createListing(data)
      toast.success("Listing created successfully")
      return ""
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Create Listing</h1>
        <p className="text-sm text-muted-foreground">
          Add a new venue or service listing
        </p>
      </div>
      <ListingForm onSave={handleSave} saving={saving} />
    </div>
  )
}
