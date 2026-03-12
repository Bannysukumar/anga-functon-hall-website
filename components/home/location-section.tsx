"use client"

import { MapPin, Navigation, Mail, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"

export function LocationSection() {
  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-4 py-18 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
      <div className="overflow-hidden rounded-3xl border border-border/70 shadow-lg">
        <iframe
          title="Anga Function Hall location"
          src="https://www.google.com/maps?q=17.6661975,80.8820389&z=16&output=embed"
          className="h-[360px] w-full md:h-[420px]"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      <div className="luxury-card rounded-3xl p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Location</p>
        <h3 className="font-display mt-3 text-3xl text-foreground">Anga Function Hall</h3>
        <p className="mt-1 text-muted-foreground">Bhadrachalam, Bhadradri Kothagudem District, Telangana, India</p>

        <div className="mt-6 space-y-3 text-sm text-muted-foreground">
          <p className="inline-flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-amber-700" /> Bhadrachalam, Bhadradri Kothagudem District, Telangana, India</p>
          <p className="inline-flex items-center gap-2"><Phone className="h-4 w-4 text-amber-700" /> +91 98855 55729</p>
          <p className="inline-flex items-center gap-2"><Mail className="h-4 w-4 text-amber-700" /> angafunctonhall@gmail.com</p>
        </div>

        <Button asChild className="mt-7 w-full rounded-xl bg-amber-500 text-amber-950 hover:bg-amber-400">
          <a
            href="https://www.google.com/maps/dir/17.6661975,80.8820389//@17.6587978,80.8875853,15z/data=!4m4!4m3!1m1!4e1!1m0?entry=ttu&g_ep=EgoyMDI2MDMwOS4wIKXMDSoASAFQAw%3D%3D"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Navigation className="h-4 w-4" />
            Get Directions
          </a>
        </Button>
      </div>
    </section>
  )
}
