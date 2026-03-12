"use client"

import { useEffect, useState } from "react"

const SHOWCASES = [
  {
    title: "Premium Rooms",
    image:
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=2000&auto=format&fit=crop",
  },
  {
    title: "Luxury Dining",
    image:
      "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?q=80&w=2000&auto=format&fit=crop",
  },
  {
    title: "Elegant Function Hall",
    image:
      "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?q=80&w=2000&auto=format&fit=crop",
  },
]

export function ParallaxShowcaseSection() {
  const [scrollY, setScrollY] = useState(0)
  const [isMobileViewport, setIsMobileViewport] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY || 0)
    const handleResize = () => setIsMobileViewport(window.innerWidth < 768)
    handleScroll()
    handleResize()
    window.addEventListener("scroll", handleScroll, { passive: true })
    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("scroll", handleScroll)
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  return (
    <section className="space-y-5 py-6">
      {SHOWCASES.map((item, index) => (
        <div
          key={item.title}
          className="relative mx-auto h-[28vh] max-w-7xl overflow-hidden rounded-3xl border border-white/20 shadow-xl md:h-[34vh] lg:h-[42vh]"
        >
          <div
            className="absolute inset-0 scale-110 bg-cover bg-center will-change-transform"
            style={{
              backgroundImage: `url("${item.image}")`,
              transform: isMobileViewport
                ? "scale(1.1)"
                : `translateY(${Math.round((scrollY * 0.12) * (index + 1) * 0.6)}px) scale(1.12)`,
            }}
          />
          <div className="absolute inset-0 bg-black/45" />
          <div className="relative flex h-full items-center justify-center px-4 text-center">
            <h3 className="font-display text-3xl text-white md:text-5xl">{item.title}</h3>
          </div>
        </div>
      ))}
    </section>
  )
}

