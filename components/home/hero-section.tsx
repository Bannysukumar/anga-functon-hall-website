"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Search, ArrowRight, Shield, Clock, CreditCard } from "lucide-react"

export function HeroSection() {
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
