"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Mail, Phone, MapPin, Instagram, Facebook, Youtube, Link as LinkIcon, MessageCircle, Star } from "lucide-react"
import { SiteLogo } from "@/components/layout/site-logo"
import { getSettings } from "@/lib/firebase-db"
import { DEFAULT_SETTINGS } from "@/lib/constants"
import type { SiteSettings } from "@/lib/types"

export function Footer() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS)
  const contactEmail =
    String(settings.contactEmail || "").trim() || DEFAULT_SETTINGS.contactEmail
  const rawPhones = String(settings.contactPhone || "").trim()
  const fallbackPhone = String(DEFAULT_SETTINGS.contactPhone || "").trim()
  const contactPhones = (rawPhones || fallbackPhone)
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
  const whatsappDigits = (contactPhones[0] || fallbackPhone).replace(/\D/g, "")
  const whatsappHref = whatsappDigits
    ? `https://wa.me/${whatsappDigits}`
    : "https://wa.me/919885555729"

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
    <footer className="border-t border-amber-200/60 bg-[#241a12] text-amber-50">
      <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
        <div className="grid gap-8 md:grid-cols-6">
          <div className="flex flex-col gap-4">
            <Link href="/" className="flex items-center gap-2">
              <SiteLogo iconClassName="h-6 w-6 text-amber-300" textClassName="font-display text-xl text-amber-100" />
            </Link>
            <p className="text-sm leading-relaxed text-amber-100/80">
              Your one-stop destination for booking premium venues and
              hospitality services across India.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-amber-200">
              Quick Links
            </h4>
            <div className="flex flex-col gap-2">
              <Link
                href="/explore"
                className="text-sm text-amber-100/80 hover:text-amber-200 transition-colors"
              >
                Explore Venues
              </Link>
              <Link
                href="/explore?type=function_hall"
                className="text-sm text-amber-100/80 hover:text-amber-200 transition-colors"
              >
                Function Halls
              </Link>
              <Link
                href="/explore?type=room"
                className="text-sm text-amber-100/80 hover:text-amber-200 transition-colors"
              >
                Rooms
              </Link>
              <Link
                href="/explore?type=dining_hall"
                className="text-sm text-amber-100/80 hover:text-amber-200 transition-colors"
              >
                Dining Halls
              </Link>
              <Link
                href="/contact"
                className="text-sm text-amber-100/80 hover:text-amber-200 transition-colors"
              >
                Contact Us
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-amber-200">Support</h4>
            <div className="flex flex-col gap-2">
              <Link
                href="/dashboard"
                className="text-sm text-amber-100/80 hover:text-amber-200 transition-colors"
              >
                My Bookings
              </Link>
              <Link
                href="/dashboard/profile"
                className="text-sm text-amber-100/80 hover:text-amber-200 transition-colors"
              >
                My Profile
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-amber-200">Legal</h4>
            <div className="flex flex-col gap-2">
              <Link
                href="/privacy-policy"
                className="text-sm text-amber-100/80 hover:text-amber-200 transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms-and-conditions"
                className="text-sm text-amber-100/80 hover:text-amber-200 transition-colors"
              >
                Terms & Conditions
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-amber-200">
              Contact Us
            </h4>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm text-amber-100/80">
                <Mail className="h-4 w-4 shrink-0" />
                <a href={`mailto:${contactEmail}`} className="hover:text-amber-200">
                  {contactEmail}
                </a>
              </div>
              {contactPhones.map((phone, index) => {
                const digits = phone.replace(/\D/g, "")
                const telHref = digits ? `tel:+${digits}` : undefined
                return (
                  <div key={`${phone}-${index}`} className="flex items-center gap-2 text-sm text-amber-100/80">
                    <Phone className="h-4 w-4 shrink-0" />
                    {telHref ? (
                      <a href={telHref} className="hover:text-amber-200">
                        {phone}
                      </a>
                    ) : (
                      <span>{phone}</span>
                    )}
                  </div>
                )
              })}
              <div className="flex items-center gap-2 text-sm text-amber-100/80">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>Bhadrachalam, Telangana</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-amber-200">Follow Us</h4>
            <div className="flex flex-col gap-2">
              {(settings.socialLinks || []).map((social, index) => (
                <a
                  key={`${social.platform}-${index}`}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-amber-100/80 hover:text-amber-200 transition-colors"
                >
                  {getSocialIcon(social.platform)}
                  <span>{social.label || social.platform}</span>
                </a>
              ))}
              <a
                href="https://www.google.com/search?sca_esv=835c64f8191b445a&sxsrf=ANbL-n4f5TTmMfDrahTC-s_-Ak4pOObe2A:1773306366811&si=AL3DRZEsmMGCryMMFSHJ3StBhOdZ2-6yYkXd_doETEE1OR-qOegdlXC2hSz8IZOGYUH06RWq4N8AMuogr9BJ2z-zYn6QbLi-Tcmx2psbOVun3a9XX9jVwv6Eqk5ZQpOlHNihk7GKk-ZkqrWyTfSKp5KdQhuhyYarH3yqhI8LnWuR8dUapASQ8zg%3D&q=Anga+Function+Hall+%E0%B0%B0%E0%B0%BF%E0%B0%B5%E0%B1%8D%E0%B0%AF%E0%B1%82%E0%B0%B2%E0%B1%81&sa=X&ved=2ahUKEwiEk8mAgZqTAxX61zgGHSIFJ3oQ0bkNegQIJBAH&biw=1536&bih=730&dpr=1.25"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-amber-100/80 hover:text-amber-200 transition-colors"
              >
                <Star className="h-4 w-4 shrink-0" />
                <span>Google Reviews</span>
              </a>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-amber-100/80 hover:text-amber-200 transition-colors"
              >
                <MessageCircle className="h-4 w-4 shrink-0" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-amber-200/30 pt-8 text-center">
          <p className="text-xs text-amber-100/70">
            {`\u00A9 ${new Date().getFullYear()} Anga Function Hall. All rights reserved.`}
          </p>
        </div>
      </div>
    </footer>
  )
}
