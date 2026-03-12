import type { MetadataRoute } from "next"
import { getSeoSlugs } from "@/lib/seo/seo-pages"

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://angafunctionhall.com"

const STATIC_ROUTES = [
  "",
  "/explore",
  "/gallery",
  "/contact",
  "/login",
  "/signup",
  "/forgot-password",
  "/terms-and-conditions",
  "/privacy-policy",
  "/seo-keywords",
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticEntries = STATIC_ROUTES.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "daily" : ("weekly" as const),
    priority: route === "" ? 1 : 0.8,
  }))

  const seoEntries = getSeoSlugs().map((slug) => ({
    url: `${BASE_URL}/${slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.85,
  }))

  return [...staticEntries, ...seoEntries]
}

