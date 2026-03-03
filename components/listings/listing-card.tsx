"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import type { Listing } from "@/lib/types"
import { LISTING_TYPE_LABELS } from "@/lib/constants"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Users, Star } from "lucide-react"

export function ListingCard({
  listing,
  branchName,
}: {
  listing: Listing
  branchName?: string
}) {
  const image = useMemo(() => {
    const first = listing.images?.[0]?.trim()
    if (!first) return null
    if (first.startsWith("http://") || first.startsWith("https://")) return first
    return null
  }, [listing.images])
  const [imageFailed, setImageFailed] = useState(false)
  const showImage = Boolean(image) && !imageFailed
  const hasOffer =
    typeof listing.originalPrice === "number" &&
    listing.originalPrice > listing.pricePerUnit
  const discountPercent = hasOffer
    ? Math.round(((listing.originalPrice! - listing.pricePerUnit) / listing.originalPrice!) * 100)
    : 0

  return (
    <Link href={`/explore/${listing.id}`}>
      <Card className="group h-full overflow-hidden transition-all hover:shadow-lg hover:border-primary/30">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {showImage ? (
            <img
              src={image!}
              alt={listing.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-sm text-muted-foreground">No image</span>
            </div>
          )}
          {listing.isFeatured && (
            <Badge className="absolute left-3 top-3 bg-accent text-accent-foreground">
              <Star className="mr-1 h-3 w-3 fill-current" />
              Featured
            </Badge>
          )}
          <Badge
            variant="secondary"
            className="absolute right-3 top-3 bg-background/90 text-foreground backdrop-blur-sm"
          >
            {LISTING_TYPE_LABELS[listing.type]}
          </Badge>
        </div>
        <CardContent className="flex flex-col gap-2 p-4">
          <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
            {listing.title}
          </h3>
          {branchName && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {branchName}
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              Up to {listing.capacity} guests
            </div>
            <div className="text-right">
              {hasOffer && (
                <p className="text-xs text-muted-foreground line-through">
                  {`\u20B9${listing.originalPrice!.toLocaleString("en-IN")}`}
                </p>
              )}
              <p className="text-lg font-bold text-primary">
                {`\u20B9${listing.pricePerUnit.toLocaleString("en-IN")}`}
              </p>
              {hasOffer && (
                <p className="text-[11px] font-medium text-emerald-600">
                  {discountPercent}% OFF
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
