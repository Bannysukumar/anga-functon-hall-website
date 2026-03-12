"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

type GalleryItem = {
  id: string
  imageUrl: string
  title?: string
  description?: string
}

const CATEGORIES = ["All", "Rooms", "Dining Hall", "Dormitory", "Function Hall", "Exterior", "Corridor"] as const

function inferCategory(item: GalleryItem) {
  const text = `${item.title || ""} ${item.description || ""}`.toLowerCase()
  if (text.includes("dining")) return "Dining Hall"
  if (text.includes("dormitory") || text.includes("bed")) return "Dormitory"
  if (text.includes("function") || text.includes("hall")) return "Function Hall"
  if (text.includes("corridor")) return "Corridor"
  if (text.includes("exterior") || text.includes("outside")) return "Exterior"
  return "Rooms"
}

export function PremiumGalleryPreview() {
  const [items, setItems] = useState<GalleryItem[]>([])
  const [activeCategory, setActiveCategory] = useState<(typeof CATEGORIES)[number]>("All")
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  useEffect(() => {
    let mounted = true
    fetch("/api/gallery")
      .then((res) => res.json())
      .then((data: { items?: GalleryItem[] }) => {
        if (!mounted) return
        setItems(Array.isArray(data.items) ? data.items.slice(0, 18) : [])
      })
      .catch(() => {
        if (mounted) setItems([])
      })
    return () => {
      mounted = false
    }
  }, [])

  const filtered = useMemo(() => {
    if (activeCategory === "All") return items
    return items.filter((item) => inferCategory(item) === activeCategory)
  }, [activeCategory, items])

  const selectedItem =
    selectedIndex != null && selectedIndex >= 0 && selectedIndex < filtered.length
      ? filtered[selectedIndex]
      : null

  return (
    <section className="mx-auto max-w-7xl px-4 py-18 lg:px-8">
      <div className="mb-7 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Gallery</p>
        <h2 className="font-display mt-3 text-3xl text-foreground md:text-4xl">Premium Visual Experience</h2>
      </div>

      <div className="mb-5 flex flex-wrap justify-center gap-2">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            suppressHydrationWarning
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              activeCategory === category
                ? "border-amber-400 bg-amber-100 text-amber-900"
                : "border-border bg-white text-muted-foreground hover:border-amber-200 hover:text-foreground"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4">
        {filtered.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20px" }}
            transition={{ duration: 0.3, delay: index * 0.015 }}
            className="mb-4 break-inside-avoid"
          >
            <button
              type="button"
              onClick={() => setSelectedIndex(index)}
              className="group w-full overflow-hidden rounded-2xl border border-border/60 bg-white text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:[transform:perspective(1000px)_rotateX(2deg)_rotateY(-3deg)]"
            >
              <img
                src={item.imageUrl}
                alt={item.title || "Gallery image"}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                loading="lazy"
              />
            </button>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 text-center">
        <Button asChild className="rounded-full bg-amber-500 px-7 text-amber-950 hover:bg-amber-400">
          <Link href="/gallery">Open Full Gallery</Link>
        </Button>
      </div>

      <Dialog open={Boolean(selectedItem)} onOpenChange={(open) => !open && setSelectedIndex(null)}>
        <DialogContent className="max-w-[96vw] border bg-background/95 p-0 sm:max-w-4xl sm:p-0">
          {selectedItem ? (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>{selectedItem.title || "Gallery image"}</DialogTitle>
                <DialogDescription>
                  {selectedItem.description || "Hotel gallery preview"}
                </DialogDescription>
              </DialogHeader>
              <div className="relative h-[70vh] w-full bg-black/90">
                <img
                  src={selectedItem.imageUrl}
                  alt={selectedItem.title || "Gallery image"}
                  className="h-full w-full object-contain"
                />
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  )
}
