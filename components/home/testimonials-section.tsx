"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

const TESTIMONIALS = [
  {
    name: "Ravi Kumar",
    city: "Hyderabad",
    quote: "Best hotel in Bhadrachalam. Clean rooms, smooth booking and excellent hospitality.",
  },
  {
    name: "Neha Sharma",
    city: "Vijayawada",
    quote: "The premium room experience and service quality felt like a five-star luxury stay.",
  },
  {
    name: "Akhil Reddy",
    city: "Warangal",
    quote: "Loved the room selection experience and transparent pricing. Highly recommended.",
  },
]

export function TestimonialsSection() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((prev) => (prev + 1) % TESTIMONIALS.length)
    }, 5000)
    return () => window.clearInterval(id)
  }, [])

  const testimonial = TESTIMONIALS[active]

  return (
    <section className="mx-auto max-w-7xl px-4 py-18 lg:px-8">
      <div className="luxury-card rounded-3xl px-6 py-10 text-center md:px-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Guest Reviews</p>
        <AnimatePresence mode="wait">
          <motion.div
            key={testimonial.name}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.32 }}
            className="mx-auto max-w-3xl"
          >
            <p className="mt-4 text-2xl text-amber-500">★★★★★</p>
            <p className="font-display mt-3 text-xl text-foreground md:text-3xl">"{testimonial.quote}"</p>
            <p className="mt-5 text-sm font-medium text-muted-foreground">
              {testimonial.name} · {testimonial.city}
            </p>
          </motion.div>
        </AnimatePresence>
        <div className="mt-6 flex items-center justify-center gap-2">
          {TESTIMONIALS.map((entry, index) => (
            <button
              key={entry.name}
              type="button"
              onClick={() => setActive(index)}
              suppressHydrationWarning
              className={`h-1.5 rounded-full transition-all ${
                index === active ? "w-8 bg-amber-500" : "w-3 bg-amber-200 hover:bg-amber-300"
              }`}
              aria-label={`Show testimonial ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
