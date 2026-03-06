"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"

type PublicGalleryItem = {
  id: string
  imageUrl: string
  title: string
  description: string
  createdAt: string | null
}

const BATCH_SIZE = 12

export default function GalleryPage() {
  const [items, setItems] = useState<PublicGalleryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [visibleCount, setVisibleCount] = useState<number>(BATCH_SIZE)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const selected = useMemo(
    () =>
      selectedIndex != null && selectedIndex >= 0 && selectedIndex < items.length
        ? items[selectedIndex]
        : null,
    [selectedIndex, items]
  )

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch("/api/gallery")
        const data = (await res.json()) as { items?: PublicGalleryItem[] }
        if (!cancelled && Array.isArray(data.items)) {
          setItems(data.items)
        }
      } catch (error) {
        console.error("Failed to load gallery", error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Reset visible count when items change
  useEffect(() => {
    setVisibleCount(BATCH_SIZE)
  }, [items.length])

  // Infinite scroll: load more when sentinel enters viewport
  useEffect(() => {
    if (!loadMoreRef.current) return
    const sentinel = loadMoreRef.current
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleCount((current) => {
              const next = current + BATCH_SIZE
              return next > items.length ? items.length : next
            })
          }
        })
      },
      { rootMargin: "200px 0px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [items.length])

  // Preload neighbouring images when lightbox is open
  useEffect(() => {
    if (selectedIndex == null) return
    if (typeof window === "undefined" || !window.Image) return
    const preload = (index: number) => {
      if (index < 0 || index >= items.length) return
      const img = new window.Image()
      img.src = items[index].imageUrl
    }
    preload(selectedIndex + 1)
    preload(selectedIndex - 1)
  }, [selectedIndex, items])

  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount]
  )

  const showLoadMoreSentinel = visibleCount < items.length && !loading

  const openAt = (index: number) => setSelectedIndex(index)
  const closeLightbox = () => setSelectedIndex(null)
  const goNext = () =>
    setSelectedIndex((current) => {
      if (current == null || items.length === 0) return current
      return (current + 1) % items.length
    })
  const goPrev = () =>
    setSelectedIndex((current) => {
      if (current == null || items.length === 0) return current
      return (current - 1 + items.length) % items.length
    })

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-secondary/20 px-4 py-8 lg:px-8">
        <section className="mx-auto flex max-w-6xl flex-col gap-6">
          <header className="flex flex-col gap-2 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Gallery
            </h1>
            <p className="mx-auto max-w-2xl text-sm text-muted-foreground md:text-base">
              A glimpse of our halls, rooms, decor and celebrations at Anga
              Function Hall.
            </p>
          </header>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: BATCH_SIZE }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-full animate-pulse rounded-xl border bg-card/60 shadow-sm"
                >
                  <div className="aspect-[4/3] w-full rounded-t-xl bg-muted" />
                  <div className="space-y-2 p-3">
                    <div className="h-3 w-2/3 rounded bg-muted" />
                    <div className="h-3 w-1/2 rounded bg-muted/80" />
                    <div className="h-3 w-1/3 rounded bg-muted/60" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
              <p className="text-base font-medium text-foreground">
                No gallery images yet.
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                Please check back later. Our team will upload photos of the
                venue and events soon.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {visibleItems.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    className="group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    onClick={() => openAt(idx)}
                  >
                    <Card className="overflow-hidden rounded-xl border border-border/60 bg-card/80 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                      <div className="relative aspect-[4/3] w-full overflow-hidden">
                        <Image
                          src={item.imageUrl}
                          alt={item.title || "Gallery image"}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          loading={idx === 0 ? "eager" : "lazy"}
                          priority={idx === 0}
                          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        {(item.title || item.description) && (
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-0.5 px-3 pb-2 pt-6 text-left text-xs text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                            {item.title && (
                              <p className="truncate text-sm font-semibold">
                                {item.title}
                              </p>
                            )}
                            {item.description && (
                              <p className="line-clamp-2 text-[11px] text-white/90">
                                {item.description}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <CardContent className="flex flex-col gap-1 p-3">
                        {item.title && (
                          <p className="truncate text-sm font-medium text-foreground">
                            {item.title}
                          </p>
                        )}
                        {item.description && (
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {item.description}
                          </p>
                        )}
                        {item.createdAt && (
                          <Badge
                            variant="outline"
                            className="mt-1 w-fit text-[10px] font-normal text-muted-foreground"
                          >
                            {new Date(item.createdAt).toLocaleDateString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              }
                            )}
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  </button>
                ))}
              </div>
              {showLoadMoreSentinel && (
                <div
                  ref={loadMoreRef}
                  className="flex items-center justify-center py-6"
                >
                  <Spinner className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </>
          )}
        </section>
      </main>
      <Footer />

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) closeLightbox()
        }}
      >
        <DialogContent className="max-w-4xl border bg-background/95 p-0 sm:p-0">
          {selected && (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>
                  {selected.title || "Gallery image"}
                </DialogTitle>
                <DialogDescription>
                  {selected.description || "Gallery image preview"}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="relative h-72 w-full bg-black/80 sm:h-96 md:h-[480px]">
                  <Image
                    src={selected.imageUrl}
                    alt={selected.title || "Gallery image"}
                    fill
                    className="rounded-t-md object-contain"
                    sizes="100vw"
                    loading="eager"
                    priority
                  />
                  {items.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={goPrev}
                        className="absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white shadow hover:bg-black/80"
                        aria-label="Previous image"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        onClick={goNext}
                        className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white shadow hover:bg-black/80"
                        aria-label="Next image"
                      >
                        ›
                      </button>
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-1 px-4 pb-4 pt-1">
                  {selected.title && (
                    <h2 className="text-base font-semibold text-foreground">
                      {selected.title}
                    </h2>
                  )}
                  {selected.description && (
                    <p className="text-sm text-muted-foreground">
                      {selected.description}
                    </p>
                  )}
                  {selected.createdAt && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Uploaded on{" "}
                      {new Date(selected.createdAt).toLocaleDateString(
                        "en-IN",
                        {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        }
                      )}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

