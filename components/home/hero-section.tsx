"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Search, ArrowRight, Shield, Clock, CreditCard } from "lucide-react"
import { getSettings } from "@/lib/firebase-db"
import { DEFAULT_SETTINGS } from "@/lib/constants"

export function HeroSection() {
  const [homeImages, setHomeImages] = useState<string[]>(
    DEFAULT_SETTINGS.heroBanners.map((banner) => banner.imageUrl)
  )

  useEffect(() => {
    let mounted = true
    getSettings()
      .then((settings) => {
        if (!mounted) return
        const banners =
          settings.heroBanners?.slice(0, 3).map((banner) => banner.imageUrl) || []
        setHomeImages(
          banners.length > 0
            ? banners
            : DEFAULT_SETTINGS.heroBanners.map((banner) => banner.imageUrl)
        )
      })
      .catch(() => {
        if (mounted) {
          setHomeImages(DEFAULT_SETTINGS.heroBanners.map((banner) => banner.imageUrl))
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  const visibleImages = useMemo(
    () => homeImages.filter((url) => typeof url === "string" && url.trim().length > 0),
    [homeImages]
  )

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28">
        <div className="flex flex-col items-center gap-8 text-center">
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl text-balance">
              Book Premium Venues
              <span className="block text-primary">For Every Occasion</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed text-pretty">
              Discover and book function halls, rooms, dormitories, dining spaces,
              and more. Instant availability checks, secure payments, and
              hassle-free booking experience.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/explore">
              <Button size="lg" className="gap-2">
                <Search className="h-4 w-4" />
                Explore Venues
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="lg" variant="outline" className="gap-2">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {visibleImages.length > 0 && (
            <div className="w-full">
              <div className="mb-3 text-left">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Anga Function Hall
                </p>
                <h3 className="text-lg font-semibold text-foreground">
                  Our Venue Highlights
                </h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleImages.map((imageUrl, index) => (
                  <div
                    key={`${imageUrl}-${index}`}
                    className="overflow-hidden rounded-xl border bg-muted/40"
                  >
                    <div className="flex aspect-[4/3] items-center justify-center bg-background p-2">
                      <img
                        src={imageUrl}
                        alt={`Anga Function Hall image ${index + 1}`}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="border-t bg-background px-3 py-2 text-left">
                      <p className="text-xs font-medium text-muted-foreground">
                        {`Venue View ${index + 1}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-full bg-primary/10 p-3">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Instant Availability
              </p>
              <p className="text-xs text-muted-foreground">
                Real-time booking status
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-full bg-primary/10 p-3">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Secure Payments
              </p>
              <p className="text-xs text-muted-foreground">
                Powered by Razorpay
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-full bg-primary/10 p-3">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Trusted Platform
              </p>
              <p className="text-xs text-muted-foreground">
                Verified venues across India
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
