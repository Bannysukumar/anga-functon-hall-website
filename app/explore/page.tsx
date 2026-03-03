"use client"

import { Suspense, useEffect, useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { getListings, getBranches } from "@/lib/firebase-db"
import type { Listing, Branch, ListingType } from "@/lib/types"
import { LISTING_TYPES, LISTING_TYPE_LABELS } from "@/lib/constants"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { ListingCard } from "@/components/listings/listing-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Search, X } from "lucide-react"

function ExplorePageContent() {
  const searchParams = useSearchParams()
  const typeParam = searchParams.get("type") || ""
  const normalizedTypeParam = typeParam === "all" ? "" : typeParam

  const [listings, setListings] = useState<Listing[]>([])
  const [branches, setBranches] = useState<Record<string, Branch>>({})
  const [loading, setLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState(normalizedTypeParam)
  const [selectedBranch, setSelectedBranch] = useState("")

  useEffect(() => {
    async function load() {
      try {
        const [listingsData, branchesData] = await Promise.all([
          getListings({ activeOnly: true }),
          getBranches(true),
        ])
        setListings(listingsData)
        const map: Record<string, Branch> = {}
        branchesData.forEach((b) => (map[b.id] = b))
        setBranches(map)
      } catch {
        // Handle error
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (selectedType && l.type !== selectedType) return false
      if (selectedBranch && l.branchId !== selectedBranch) return false
      if (
        searchQuery &&
        !l.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !l.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false
      return true
    })
  }, [listings, selectedType, selectedBranch, searchQuery])

  function clearFilters() {
    setSearchQuery("")
    setSelectedType("")
    setSelectedBranch("")
  }

  const hasFilters = searchQuery || selectedType || selectedBranch

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Explore Venues
              </h1>
              <p className="text-sm text-muted-foreground">
                {filtered.length} venue{filtered.length !== 1 ? "s" : ""}{" "}
                available
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search venues..."
                  className="pl-10"
                />
              </div>
              <Select
                value={selectedType}
                onValueChange={(value) =>
                  setSelectedType(value === "all" ? "" : value)
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {LISTING_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {LISTING_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedBranch}
                onValueChange={(value) =>
                  setSelectedBranch(value === "all" ? "" : value)
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {Object.values(branches).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground"
                >
                  <X className="mr-1 h-3 w-3" />
                  Clear
                </Button>
              )}
            </div>

            {/* Results */}
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <Spinner className="h-8 w-8" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-lg border border-dashed">
                <p className="text-muted-foreground">
                  No venues found matching your criteria
                </p>
                {hasFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    branchName={branches[listing.branchId]?.name}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      }
    >
      <ExplorePageContent />
    </Suspense>
  )
}
