"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getListings, deleteListing, getBranches, createListing } from "@/lib/firebase-db"
import type { Listing, Branch } from "@/lib/types"
import { LISTING_TYPE_LABELS } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Spinner } from "@/components/ui/spinner"
import { Plus, Pencil, Trash2, Star, Copy } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/hooks/use-auth"

export default function ListingsPage() {
  const { hasPermission, isAdminUser } = useAuth()
  const [listings, setListings] = useState<Listing[]>([])
  const [branches, setBranches] = useState<Record<string, Branch>>({})
  const [loading, setLoading] = useState(true)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

  async function loadData() {
    try {
      const [listingsData, branchesData] = await Promise.all([
        getListings(),
        getBranches(),
      ])
      const uniqueById = new Map<string, Listing>()
      listingsData.forEach((listing) => {
        uniqueById.set(String(listing.id), {
          ...listing,
          isActive: Boolean(listing.isActive),
          isFeatured: Boolean(listing.isFeatured),
        })
      })
      setListings(Array.from(uniqueById.values()))
      const branchMap: Record<string, Branch> = {}
      branchesData.forEach((b) => {
        branchMap[b.id] = b
      })
      setBranches(branchMap)
    } catch {
      toast.error("Failed to load listings")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleDelete(id: string) {
    if (!isAdminUser && !hasPermission("LISTINGS_DELETE")) {
      toast.error("You do not have permission to delete listings.")
      return
    }
    if (!confirm("Are you sure you want to delete this listing?")) return
    try {
      await deleteListing(id)
      toast.success("Listing deleted")
      await loadData()
    } catch {
      toast.error("Failed to delete listing")
    }
  }

  async function handleDuplicate(listing: Listing) {
    if (!isAdminUser && !hasPermission("LISTINGS_CREATE_EDIT")) {
      toast.error("You do not have permission to duplicate listings.")
      return
    }
    setDuplicatingId(listing.id)
    try {
      const suffix = Date.now().toString().slice(-4)
      const duplicateTitle = `${listing.title} (Copy)`
      const duplicateRoomId = listing.roomId
        ? `${String(listing.roomId).trim().toUpperCase()}-COPY-${suffix}`
        : ""
      const duplicateRoomNumber = listing.roomNumber
        ? `${String(listing.roomNumber).trim()} Copy`
        : ""
      const { id: _ignoredId, createdAt: _ignoredCreatedAt, updatedAt: _ignoredUpdatedAt, ...listingWithoutMeta } = listing

      const payload: Omit<Listing, "id" | "createdAt" | "updatedAt"> = {
        ...listingWithoutMeta,
        title: duplicateTitle,
        roomId: duplicateRoomId,
        roomNumber: duplicateRoomNumber,
        isActive: false,
        isFeatured: false,
      }

      await createListing(payload)
      toast.success("Listing duplicated as inactive draft")
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to duplicate listing")
    } finally {
      setDuplicatingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Listings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your venue and service listings
          </p>
        </div>
        {(isAdminUser || hasPermission("LISTINGS_CREATE_EDIT")) && (
          <Link href="/admin/listings/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Listing
            </Button>
          </Link>
        )}
      </div>

      {listings.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
          <p className="text-sm text-muted-foreground">
            No listings yet. Create your first listing.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listings.map((listing) => (
                <TableRow key={listing.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{listing.title}</span>
                      {listing.isFeatured && (
                        <Star className="h-3 w-3 fill-accent text-accent" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {LISTING_TYPE_LABELS[listing.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {branches[listing.branchId]?.name || "Unknown"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {`\u20B9${listing.pricePerUnit.toLocaleString("en-IN")}`}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        listing.isActive
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }
                    >
                      {listing.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {(isAdminUser || hasPermission("LISTINGS_CREATE_EDIT")) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Duplicate listing"
                          disabled={duplicatingId === listing.id}
                          onClick={() => void handleDuplicate(listing)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                      {(isAdminUser || hasPermission("LISTINGS_CREATE_EDIT")) && (
                        <Link href={`/admin/listings/${listing.id}/edit`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Edit listing"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                      )}
                      {(isAdminUser || hasPermission("LISTINGS_DELETE")) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(listing.id)}
                          aria-label="Delete listing"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
