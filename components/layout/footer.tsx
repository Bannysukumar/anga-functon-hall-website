"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Mail, Phone, MapPin, Instagram, Facebook, Youtube, Link as LinkIcon } from "lucide-react"
import { SiteLogo } from "@/components/layout/site-logo"
import { getSettings } from "@/lib/firebase-db"
import { DEFAULT_SETTINGS } from "@/lib/constants"
import type { SiteSettings } from "@/lib/types"

export function Footer() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    let mounted = true
    getSettings()
      .then((data) => {
        if (mounted) setSettings(data)
      })
      .catch(() => {
        // keep defaults
      })
    return () => {
      mounted = false
    }
  }, [])

  function getSocialIcon(platform: string) {
    const key = platform.toLowerCase()
    if (key.includes("instagram")) return <Instagram className="h-4 w-4 shrink-0" />
    if (key.includes("facebook")) return <Facebook className="h-4 w-4 shrink-0" />
    if (key.includes("youtube")) return <Youtube className="h-4 w-4 shrink-0" />
    return <LinkIcon className="h-4 w-4 shrink-0" />
  }

  return (
    <footer className="border-t bg-secondary/50">
      <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
        <div className="grid gap-8 md:grid-cols-6">
          <div className="flex flex-col gap-4">
            <Link href="/" className="flex items-center gap-2">
              <SiteLogo />
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your one-stop destination for booking premium venues and
              hospitality services across India.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-foreground">
              Quick Links
            </h4>
            <div className="flex flex-col gap-2">
              <Link
                href="/explore"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Explore Venues
              </Link>
              <Link
                href="/explore?type=function_hall"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Function Halls
              </Link>
              <Link
                href="/explore?type=room"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Rooms
              </Link>
              <Link
                href="/explore?type=dining_hall"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Dining Halls
              </Link>
              <Link
                href="/contact"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Contact Us
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-foreground">Support</h4>
            <div className="flex flex-col gap-2">
              <Link
                href="/dashboard"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                My Bookings
              </Link>
              <Link
                href="/dashboard/profile"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                My Profile
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-foreground">Legal</h4>
            <div className="flex flex-col gap-2">
              <Link
                href="/privacy-policy"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms-and-conditions"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Terms & Conditions
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-foreground">
              Contact Us
            </h4>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                <span>angafunctonhall@gmail.com</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0" />
                <span>098855 55729</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>Bhadrachalam, Telangana</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-foreground">Follow Us</h4>
            <div className="flex flex-col gap-2">
              {(settings.socialLinks || []).map((social, index) => (
                <a
                  key={`${social.platform}-${index}`}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {getSocialIcon(social.platform)}
                  <span>{social.label || social.platform}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 border-t pt-8 text-center">
          <p className="text-xs text-muted-foreground">
            {`\u00A9 ${new Date().getFullYear()} Anga Function Hall. All rights reserved.`}
          </p>
        </div>
      </div>
    </footer>
  )
}
