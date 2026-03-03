"use client"

import { useEffect, useState } from "react"
import { getListings, getBranches } from "@/lib/firebase-db"
import type { Listing, Branch } from "@/lib/types"
import { ListingCard } from "@/components/listings/listing-card"
import { Spinner } from "@/components/ui/spinner"

export function FeaturedListings() {
  const [listings, setListings] = useState<Listing[]>([])
  const [branches, setBranches] = useState<Record<string, Branch>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [listingsData, branchesData] = await Promise.all([
          getListings({ activeOnly: true, featuredOnly: true, limitCount: 6 }),
          getBranches(true),
        ])
        setListings(listingsData)
        const map: Record<string, Branch> = {}
        branchesData.forEach((b) => (map[b.id] = b))
        setBranches(map)
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (listings.length === 0) return null

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
      <div className="flex flex-col gap-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground text-balance">
            Featured Venues
          </h2>
          <p className="mt-2 text-muted-foreground">
            Handpicked premium venues for your special events
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              branchName={branches[listing.branchId]?.name}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
