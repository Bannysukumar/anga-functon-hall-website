"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Premium Picks</p>
          <h2 className="font-display mt-3 text-3xl text-foreground text-balance md:text-4xl">
            Featured Luxury Properties
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Handpicked stays and event venues with elegant ambience and premium comfort.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing, index) => (
            <motion.div
              key={listing.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ duration: 0.33, delay: index * 0.03 }}
            >
              <ListingCard
                listing={listing}
                branchName={branches[listing.branchId]?.name}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
