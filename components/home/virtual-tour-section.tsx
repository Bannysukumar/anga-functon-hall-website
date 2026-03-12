"use client"

import { Compass, PlayCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export function VirtualTourSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-18 lg:px-8">
      <div className="relative overflow-hidden rounded-3xl border border-amber-200/60 bg-gradient-to-br from-amber-50 via-white to-stone-100 px-6 py-10 md:px-10">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-14 h-56 w-56 rounded-full bg-yellow-200/20 blur-3xl" />

        <div className="relative grid items-center gap-7 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Premium Feature</p>
            <h3 className="font-display mt-3 text-3xl text-foreground md:text-4xl">Explore Our 360° Virtual Tour</h3>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Walk through rooms, dining spaces and event venues before booking. Get a complete immersive preview of your stay.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-amber-200/60 bg-white/80 p-6">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <Compass className="h-4 w-4 text-amber-700" />
              Rotate, zoom and move around
            </p>
            <Button asChild className="rounded-xl bg-amber-500 px-6 text-amber-950 hover:bg-amber-400">
              <a href="/gallery">
                <PlayCircle className="h-4 w-4" />
                Enter Virtual Tour
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
