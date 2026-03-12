"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import type { Listing } from "@/lib/types"
import { LISTING_TYPE_LABELS } from "@/lib/constants"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Users, Star, Snowflake, Wifi, Tv } from "lucide-react"

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
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const showImage = Boolean(image) && !imageFailed
  const hasOffer =
    typeof listing.originalPrice === "number" &&
    listing.originalPrice > listing.pricePerUnit
  const discountPercent = hasOffer
    ? Math.round(((listing.originalPrice! - listing.pricePerUnit) / listing.originalPrice!) * 100)
    : 0

  return (
    <Link href={`/explore/${listing.id}`}>
      <Card
        className="luxury-card group h-full overflow-hidden rounded-2xl border-border/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const x = event.clientX - rect.left
          const y = event.clientY - rect.top
          const rotateX = ((y / rect.height) - 0.5) * -6
          const rotateY = ((x / rect.width) - 0.5) * 6
          setTilt({ x: rotateX, y: rotateY })
        }}
        onMouseLeave={() => setTilt({ x: 0, y: 0 })}
        style={{
          transform: `perspective(1200px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        }}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {showImage ? (
            <img
              src={image!}
              alt={listing.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-sm text-muted-foreground">No image</span>
            </div>
          )}
          {listing.isFeatured ? (
            <Badge className="absolute left-3 top-3 bg-amber-100 text-amber-900">
              <Star className="mr-1 h-3 w-3 fill-current" />
              Featured
            </Badge>
          ) : null}
          <Badge
            variant="secondary"
            className="absolute right-3 top-3 bg-background/90 text-foreground backdrop-blur-sm"
          >
            {LISTING_TYPE_LABELS[listing.type]}
          </Badge>
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </div>
        <CardContent className="flex flex-col gap-2 p-4">
          <h3 className="font-display text-xl font-semibold text-foreground line-clamp-1 group-hover:text-amber-800 transition-colors">
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
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1"><Snowflake className="h-3 w-3" /> AC</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1"><Wifi className="h-3 w-3" /> WiFi</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1"><Tv className="h-3 w-3" /> Smart TV</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
