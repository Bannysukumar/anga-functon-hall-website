"use client"

import Link from "next/link"
import { LISTING_TYPES, LISTING_TYPE_LABELS } from "@/lib/constants"
import type { ListingType } from "@/lib/types"
import {
  Building2,
  BedDouble,
  Hotel,
  UtensilsCrossed,
  Tent,
  MapPin,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

const ICONS: Record<ListingType, React.ElementType> = {
  function_hall: Building2,
  room: BedDouble,
  dormitory: Hotel,
  dining_hall: UtensilsCrossed,
  open_function_hall: Tent,
  local_tour: MapPin,
}

const DESCRIPTIONS: Record<ListingType, string> = {
  function_hall: "Indoor halls for weddings, parties and events",
  room: "Comfortable rooms for overnight stays",
  dormitory: "Affordable shared accommodation",
  dining_hall: "Dining spaces for group meals and catering",
  open_function_hall: "Open-air venues for outdoor events",
  local_tour: "Guided tours of local attractions",
}

export function CategoryCards() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
      <div className="flex flex-col gap-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground text-balance">
            Explore Our Services
          </h2>
          <p className="mt-2 text-muted-foreground">
            Find the perfect space for every occasion
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LISTING_TYPES.map((type) => {
            const Icon = ICONS[type]
            return (
              <Link key={type} href={`/explore?type=${type}`}>
                <Card className="group h-full transition-all hover:shadow-lg hover:border-primary/30">
                  <CardContent className="flex items-start gap-4 p-6">
                    <div className="rounded-xl bg-primary/10 p-3 transition-colors group-hover:bg-primary/20">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="font-semibold text-foreground">
                        {LISTING_TYPE_LABELS[type]}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {DESCRIPTIONS[type]}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
