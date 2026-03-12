"use client"

import { motion } from "framer-motion"
import {
  Wifi,
  Snowflake,
  Car,
  UtensilsCrossed,
  BedDouble,
  Building2,
  ConciergeBell,
  Droplets,
} from "lucide-react"

const FACILITIES = [
  { icon: Wifi, label: "Free WiFi" },
  { icon: Snowflake, label: "AC Rooms" },
  { icon: Car, label: "Parking" },
  { icon: UtensilsCrossed, label: "Dining Hall" },
  { icon: BedDouble, label: "Dormitory" },
  { icon: Building2, label: "Function Hall" },
  { icon: ConciergeBell, label: "24/7 Service" },
  { icon: Droplets, label: "Hot Water" },
]

export function FacilitiesSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-18 lg:px-8">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Facilities</p>
        <h2 className="font-display mt-3 text-3xl text-foreground md:text-4xl">Luxury Comforts Included</h2>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {FACILITIES.map((item, index) => {
          const Icon = item.icon
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -6, scale: 1.02 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.38, delay: index * 0.03 }}
              className="luxury-card rounded-2xl p-5 text-center"
            >
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-foreground">{item.label}</p>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
