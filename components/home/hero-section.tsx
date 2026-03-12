"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowRight, BedDouble, CalendarDays, Search, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getSettings } from "@/lib/firebase-db"
import { DEFAULT_SETTINGS } from "@/lib/constants"
import type { HeroBanner } from "@/lib/types"

export function HeroSection() {
  const router = useRouter()
  const [homeBanners, setHomeBanners] = useState<HeroBanner[]>(DEFAULT_SETTINGS.heroBanners)
  const [checkInDate, setCheckInDate] = useState("")
  const [checkOutDate, setCheckOutDate] = useState("")
  const [guests, setGuests] = useState(2)
  const [roomType, setRoomType] = useState("all")
  const [currentSlide, setCurrentSlide] = useState(0)
  const [scrollY, setScrollY] = useState(0)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    let mounted = true
    getSettings()
      .then((settings) => {
        if (!mounted) return
        const banners = (settings.heroBanners || [])
          .filter((banner) => String(banner?.imageUrl || "").trim().length > 0)
          .map((banner, index) => ({
            imageUrl: String(banner.imageUrl || "").trim(),
            title: String(banner.title || `Venue View ${index + 1}`).trim(),
            subtitle: String(banner.subtitle || "").trim(),
            isActive: banner.isActive !== false,
            order: Number.isFinite(Number(banner.order)) ? Number(banner.order) : index,
            uploadedAt: String(banner.uploadedAt || ""),
          }))
        setHomeBanners(banners.length > 0 ? banners : DEFAULT_SETTINGS.heroBanners)
      })
      .catch(() => {
        if (mounted) {
          setHomeBanners(DEFAULT_SETTINGS.heroBanners)
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  const visibleBanners = useMemo(
    () =>
      homeBanners.filter(
        (banner) =>
          typeof banner?.imageUrl === "string" && banner.imageUrl.trim().length > 0
      ),
    [homeBanners]
  )

  const activeBanners = useMemo(() => {
    const normalized = visibleBanners
      .map((banner, index) => ({
        ...banner,
        isActive: banner.isActive !== false,
        order: Number.isFinite(Number(banner.order)) ? Number(banner.order) : index,
      }))
      .filter((banner) => banner.isActive)
      .sort((a, b) => a.order - b.order)
    return normalized.length > 0
      ? normalized
      : [{
          imageUrl:
            "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2200&auto=format&fit=crop",
          title: "Default Hero",
          subtitle: "",
          isActive: true,
          order: 0,
        }]
  }, [visibleBanners])

  useEffect(() => {
    setCurrentSlide(0)
  }, [activeBanners.length])

  useEffect(() => {
    if (activeBanners.length <= 1) return
    const interval = window.setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % activeBanners.length)
    }, isMobileViewport ? 6500 : 5000)
    return () => window.clearInterval(interval)
  }, [activeBanners.length, isMobileViewport])

  useEffect(() => {
    if (activeBanners.length <= 1) return
    const nextIndex = (currentSlide + 1) % activeBanners.length
    const nextImageUrl = activeBanners[nextIndex]?.imageUrl
    if (!nextImageUrl || typeof window === "undefined" || !window.Image) return
    const image = new window.Image()
    image.src = nextImageUrl
  }, [activeBanners, currentSlide])

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY || 0)
    const handleResize = () => setIsMobileViewport(window.innerWidth < 768)
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const handleMotion = () => setReduceMotion(media.matches)
    handleScroll()
    handleResize()
    handleMotion()
    window.addEventListener("scroll", handleScroll, { passive: true })
    window.addEventListener("resize", handleResize)
    media.addEventListener("change", handleMotion)
    return () => {
      window.removeEventListener("scroll", handleScroll)
      window.removeEventListener("resize", handleResize)
      media.removeEventListener("change", handleMotion)
    }
  }, [])

  function handleSearchRooms() {
    const params = new URLSearchParams()
    if (roomType !== "all") params.set("type", roomType)
    if (checkInDate) params.set("checkIn", checkInDate)
    if (checkOutDate) params.set("checkOut", checkOutDate)
    params.set("guests", String(Math.max(1, guests)))
    router.push(`/explore?${params.toString()}`)
  }

  return (
    <section className="relative isolate min-h-[88vh] overflow-hidden md:min-h-screen">
      <div className="absolute inset-0 -z-20">
        {activeBanners.map((banner, index) => (
          <div
            key={`${banner.imageUrl}-${index}`}
            className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000 ${
              index === currentSlide ? "opacity-100" : "opacity-0"
            }`}
            style={{
              backgroundImage: `url("${banner.imageUrl}")`,
              backgroundPosition:
                !isMobileViewport && !reduceMotion
                  ? `center ${Math.round(scrollY * 0.14)}px`
                  : "center center",
              transform:
                reduceMotion || isMobileViewport
                  ? "scale(1.02)"
                  : index === currentSlide
                    ? "scale(1.06)"
                    : "scale(1)",
              transition:
                reduceMotion
                  ? "opacity 600ms ease"
                  : "opacity 1000ms ease, transform 5000ms ease",
            }}
          />
        ))}
      </div>
      <div className="absolute inset-0 -z-10 luxury-hero-overlay" />

      <div className="mx-auto flex min-h-[88vh] max-w-7xl items-center px-4 pb-10 pt-24 md:min-h-screen md:pb-14 md:pt-28 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1.2fr_0.95fr] lg:gap-12">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="self-center text-white"
          >
            <p className="mb-3 inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/90">
              Anga Function Hall
            </p>
            <h1 className="font-display text-3xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
              Luxury Hotel in Bhadrachalam
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/85 sm:mt-5 sm:text-lg">
              Experience royal comfort, elegant rooms, curated dining spaces, and premium hospitality designed for unforgettable stays.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 sm:mt-8 sm:gap-4">
              <Button
                asChild
                size="lg"
                className="luxury-glass rounded-full border-white/35 bg-white/15 px-7 text-white hover:bg-white/25"
              >
                <Link href="/explore">
                  Book Your Stay
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                className="rounded-full border border-white/40 bg-transparent px-7 text-white hover:bg-white/15"
              >
                <Link href="/gallery">
                  Explore Rooms
                  <Search className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 34 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.12, ease: "easeOut" }}
            className="luxury-glass rounded-3xl p-5 text-white sm:p-6"
            style={{ animation: reduceMotion ? "none" : "floatY 5.8s ease-in-out infinite" }}
          >
            <p className="mb-4 font-display text-2xl">Smart Booking</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-medium uppercase tracking-wide text-white/80">
                <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />Check-in</span>
                <input
                  type="date"
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  suppressHydrationWarning
                  className="w-full rounded-xl border border-white/25 bg-white/15 px-3 py-2 text-sm text-white outline-none placeholder:text-white/70 focus:border-white/45"
                />
              </label>
              <label className="space-y-1 text-xs font-medium uppercase tracking-wide text-white/80">
                <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />Check-out</span>
                <input
                  type="date"
                  value={checkOutDate}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  suppressHydrationWarning
                  className="w-full rounded-xl border border-white/25 bg-white/15 px-3 py-2 text-sm text-white outline-none placeholder:text-white/70 focus:border-white/45"
                />
              </label>
              <label className="space-y-1 text-xs font-medium uppercase tracking-wide text-white/80">
                <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />Guests</span>
                <input
                  type="number"
                  min={1}
                  value={guests}
                  onChange={(e) => setGuests(Number(e.target.value || 1))}
                  suppressHydrationWarning
                  className="w-full rounded-xl border border-white/25 bg-white/15 px-3 py-2 text-sm text-white outline-none placeholder:text-white/70 focus:border-white/45"
                />
              </label>
              <label className="space-y-1 text-xs font-medium uppercase tracking-wide text-white/80">
                <span className="inline-flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" />Room Type</span>
                <select
                  value={roomType}
                  onChange={(e) => setRoomType(e.target.value)}
                  suppressHydrationWarning
                  className="w-full rounded-xl border border-white/25 bg-white/15 px-3 py-2 text-sm text-white outline-none focus:border-white/45"
                >
                  <option value="all" className="text-black">All</option>
                  <option value="room" className="text-black">Room</option>
                  <option value="dormitory" className="text-black">Dormitory</option>
                  <option value="dining_hall" className="text-black">Dining Hall</option>
                  <option value="function_hall" className="text-black">Function Hall</option>
                </select>
              </label>
            </div>
            <Button
              onClick={handleSearchRooms}
              suppressHydrationWarning
              className="mt-4 w-full rounded-xl bg-amber-400 py-4 text-base font-semibold text-amber-950 shadow-[0_0_0_1px_rgba(251,191,36,0.5),0_8px_28px_rgba(245,158,11,0.45)] transition hover:bg-amber-300 hover:shadow-[0_0_0_1px_rgba(251,191,36,0.65),0_12px_34px_rgba(245,158,11,0.6)] sm:py-5"
            >
              Search Rooms
            </Button>
          </motion.div>
        </div>
      </div>
      {activeBanners.length > 1 ? (
        <div className="absolute bottom-7 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
          {activeBanners.map((banner, index) => (
            <button
              key={`${banner.imageUrl}-${index}`}
              type="button"
              onClick={() => setCurrentSlide(index)}
              suppressHydrationWarning
              className={`h-1.5 rounded-full transition-all ${
                index === currentSlide ? "w-8 bg-amber-300" : "w-3 bg-white/50 hover:bg-white/80"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
