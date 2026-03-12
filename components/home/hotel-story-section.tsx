"use client"

import { motion } from "framer-motion"

export function HotelStorySection() {
  return (
    <section className="mx-auto grid max-w-7xl items-center gap-6 px-4 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-18">
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="overflow-hidden rounded-3xl border border-amber-200/50 bg-white shadow-lg"
      >
        <img
          src="https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=1800&auto=format&fit=crop"
          alt="Luxury hotel interior"
          className="h-[320px] w-full object-cover transition duration-700 hover:scale-105 md:h-[420px]"
          loading="lazy"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 30 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.55, delay: 0.08 }}
        className="luxury-card rounded-3xl p-7 md:p-9"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Hotel Story</p>
        <h2 className="font-display mt-3 text-3xl text-foreground md:text-4xl">
          Experience Royal Comfort in Bhadrachalam
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">
          Anga Function Hall offers luxurious rooms, modern amenities, and premium hospitality for families and
          travelers visiting Bhadrachalam. Designed for comfort and elegance, our stay and event spaces blend
          convenience with a cinematic ambience.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
          From elegant room stays to function and dining experiences, every corner is curated to make your visit
          memorable.
        </p>
      </motion.div>
    </section>
  )
}

