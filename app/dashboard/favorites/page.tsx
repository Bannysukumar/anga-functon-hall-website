"use client"

import { useAuth } from "@/lib/hooks/use-auth"
import { getListings } from "@/lib/firebase-db"
import { updateUser } from "@/lib/firebase-db"
import type { Listing } from "@/lib/types"
import { LISTING_TYPE_LABELS } from "@/lib/constants"
import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Heart,
  MapPin,
  Loader2,
  HeartOff,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function FavoritesPage() {
  const { user, appUser, refreshUser } = useAuth()
  const { toast } = useToast()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        if (!appUser?.favorites || appUser.favorites.length === 0) {
          setListings([])
          setLoading(false)
          return
        }
        const all = await getListings({ activeOnly: true })
        const favs = all.filter((l) => appUser.favorites.includes(l.id))
        setListings(favs)
      } catch (err) {
        console.error("Error loading favorites:", err)
      } finally {
        setLoading(false)
      }
    }
    if (appUser !== undefined) load()
  }, [appUser])

  const removeFavorite = async (listingId: string) => {
    if (!user || !appUser) return
    try {
      const newFavs = (appUser.favorites || []).filter(
        (id) => id !== listingId
      )
      await updateUser(user.uid, { favorites: newFavs })
      setListings((prev) => prev.filter((l) => l.id !== listingId))
      await refreshUser()
      toast({ title: "Removed from favorites" })
    } catch {
      toast({
        title: "Error",
        description: "Failed to remove from favorites.",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Favorites</h1>
        <p className="text-sm text-muted-foreground">
          Listings you have saved for later
        </p>
      </div>

      {listings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <HeartOff className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">
              No favorites yet
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse listings and save the ones you like.
            </p>
            <Button asChild className="mt-4">
              <Link href="/explore">Explore Venues</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <Card key={listing.id} className="group overflow-hidden transition-shadow hover:shadow-md">
              <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
                {listing.images?.[0] ? (
                  <Image
                    src={listing.images[0]}
                    alt={listing.title}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <MapPin className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-2 top-2 h-8 w-8 rounded-full"
                  onClick={(e) => {
                    e.preventDefault()
                    removeFavorite(listing.id)
                  }}
                >
                  <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                </Button>
              </div>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Badge variant="secondary" className="mb-1.5 text-xs">
                      {LISTING_TYPE_LABELS[listing.type]}
                    </Badge>
                    <h3 className="truncate font-semibold text-foreground">
                      {listing.title}
                    </h3>
                    {typeof listing.originalPrice === "number" &&
                    listing.originalPrice > listing.pricePerUnit ? (
                      <div className="mt-1">
                        <p className="text-xs text-muted-foreground line-through">
                          {"₹"}{listing.originalPrice.toLocaleString("en-IN")}
                        </p>
                        <p className="text-sm font-medium text-primary">
                          {"₹"}{listing.pricePerUnit.toLocaleString("en-IN")}
                          <span className="text-xs font-normal text-muted-foreground">
                            {" "}/ unit
                          </span>
                        </p>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm font-medium text-primary">
                        {"₹"}{listing.pricePerUnit.toLocaleString("en-IN")}
                        <span className="text-xs font-normal text-muted-foreground">
                          {" "}/ unit
                        </span>
                      </p>
                    )}
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                  <Link href={`/explore/${listing.id}`}>View Details</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
