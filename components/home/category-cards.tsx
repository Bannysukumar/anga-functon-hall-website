"use client"

import Link from "next/link"
import { motion } from "framer-motion"
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Collections</p>
          <h2 className="font-display mt-3 text-3xl text-foreground text-balance md:text-4xl">
            Curated Luxury Stays and Venues
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Find your ideal space for weddings, family stays, business events and premium gatherings.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LISTING_TYPES.map((type, index) => {
            const Icon = ICONS[type]
            return (
              <motion.div
                key={type}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-20px" }}
                transition={{ duration: 0.35, delay: index * 0.03 }}
              >
                <Link href={`/explore?type=${type}`}>
                  <Card className="luxury-card group h-full rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                    <CardContent className="flex items-start gap-4 p-6">
                      <div className="rounded-xl bg-amber-100 p-3 text-amber-800 transition-colors group-hover:bg-amber-200">
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
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
