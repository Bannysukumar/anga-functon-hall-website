export type SeoPageType = "landing" | "blog"

export interface SeoPageDefinition {
  slug: string
  type: SeoPageType
  keyword: string
  title: string
  description: string
}

const HOTEL_NAME = "Anga Function Hall"
const CITY = "Bhadrachalam"
const LONG_TAIL_TARGET_COUNT = 1000
const RESERVED_SLUGS = new Set([
  "",
  "access-denied",
  "admin",
  "admin-dashboard",
  "checkout",
  "contact",
  "dashboard",
  "explore",
  "force-password-change",
  "forgot-password",
  "gallery",
  "invoice",
  "login",
  "login-phone",
  "payment",
  "privacy-policy",
  "receptionist",
  "reset-password",
  "seo-keywords",
  "robots.txt",
  "signup",
  "sitemap.xml",
  "terms-and-conditions",
])

const CITY_VARIATIONS = [
  "Bhadrachalam",
  "Bhadradri Kothagudem",
  "Kothagudem",
  "Palvancha",
  "Manuguru",
  "Burgampahad",
  "Charla",
  "Dummugudem",
]

const ATTRACTIONS = [
  "Bhadrachalam Temple",
  "Sri Seetha Ramachandra Swamy Temple",
  "Godavari River",
  "Bhadrachalam Bus Stand",
  "Bhadrachalam Railway Station",
  "Parnasala",
  "Kinnerasani Wildlife Sanctuary",
  "Kinnerasani Dam",
]

const CORE_PATTERNS = [
  "hotel in {city}",
  "best hotel in {city}",
  "budget hotel in {city}",
  "cheap hotel in {city}",
  "luxury hotel in {city}",
  "family hotel in {city}",
  "hotel for family in {city}",
  "hotel for marriage in {city}",
  "hotel booking in {city}",
  "online hotel booking in {city}",
  "same day hotel booking in {city}",
  "hotel with parking in {city}",
  "hotel with free wifi in {city}",
  "hotel with 24 7 service in {city}",
  "ac rooms in {city}",
  "non ac rooms in {city}",
  "premium rooms in {city}",
  "budget rooms in {city}",
  "dormitory in {city}",
  "dormitory for groups in {city}",
  "dining hall in {city}",
  "function hall in {city}",
  "banquet hall in {city}",
  "conference hall in {city}",
  "event hall booking in {city}",
  "hotel for pilgrims in {city}",
  "stay for temple visit in {city}",
  "best accommodation in {city}",
  "hotel near {attraction}",
  "rooms near {attraction}",
  "stay near {attraction}",
]

const SEARCH_INTENTS = [
  "hotel",
  "best hotel",
  "budget hotel",
  "cheap hotel",
  "luxury hotel",
  "family hotel",
  "ac rooms",
  "non ac rooms",
  "premium rooms",
  "dormitory",
  "group stay hotel",
  "hotel booking",
  "function hall",
  "dining hall",
  "banquet hall",
  "conference hall",
]

const AUDIENCE_TARGETS = [
  "family",
  "pilgrims",
  "tourists",
  "group travellers",
  "students",
  "corporate guests",
  "wedding guests",
  "weekend travellers",
]

const AMENITY_TARGETS = [
  "parking",
  "free wifi",
  "hot water",
  "24 7 service",
  "dining hall",
  "function hall",
  "dormitory",
  "ac rooms",
]

const BLOG_PAGES: SeoPageDefinition[] = [
  {
    slug: "top-places-to-visit-in-bhadrachalam",
    type: "blog",
    keyword: "Top Places to Visit in Bhadrachalam",
    title: "Top Places to Visit in Bhadrachalam | Travel Guide",
    description:
      "Explore top attractions in Bhadrachalam including temple routes, river views and local experiences with stay recommendations.",
  },
  {
    slug: "best-hotels-in-bhadrachalam",
    type: "blog",
    keyword: "Best Hotels in Bhadrachalam",
    title: "Best Hotels in Bhadrachalam | Where to Stay",
    description:
      "Compare the best hotels in Bhadrachalam with amenities, room options, family stays and booking tips.",
  },
  {
    slug: "bhadrachalam-travel-guide",
    type: "blog",
    keyword: "Bhadrachalam Travel Guide",
    title: "Bhadrachalam Travel Guide | Stay, Food and Temple Trip",
    description:
      "A practical Bhadrachalam travel guide with itinerary tips, stay options, local food and temple visit planning.",
  },
  {
    slug: "best-time-to-visit-bhadrachalam",
    type: "blog",
    keyword: "Best Time to Visit Bhadrachalam",
    title: "Best Time to Visit Bhadrachalam | Seasonal Guide",
    description:
      "Know the best season to visit Bhadrachalam, crowd patterns and how to book hotel rooms and halls in advance.",
  },
]

function toTitleCase(value: string) {
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function titleFromSlug(slug: string) {
  return toTitleCase(
    slug
    .split("-")
    .join(" ")
  )
}

function buildLongTailKeywords(targetCount: number) {
  const keywords: string[] = []
  const seen = new Set<string>()

  const addKeyword = (value: string) => {
    const normalized = value.toLowerCase().replace(/\s+/g, " ").trim()
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    keywords.push(value.trim())
  }

  for (const city of CITY_VARIATIONS) {
    for (const pattern of CORE_PATTERNS) {
      for (const attraction of ATTRACTIONS) {
        addKeyword(
          pattern
          .replaceAll("{city}", city)
          .replaceAll("{attraction}", attraction)
        )
        if (keywords.length >= targetCount) {
          return keywords
        }
      }
    }
  }

  for (const city of CITY_VARIATIONS) {
    for (const intent of SEARCH_INTENTS) {
      addKeyword(`${intent} in ${city}`)
      for (const audience of AUDIENCE_TARGETS) {
        addKeyword(`${intent} for ${audience} in ${city}`)
        if (keywords.length >= targetCount) return keywords
      }
      for (const amenity of AMENITY_TARGETS) {
        addKeyword(`${intent} with ${amenity} in ${city}`)
        if (keywords.length >= targetCount) return keywords
      }
      for (const attraction of ATTRACTIONS) {
        addKeyword(`${intent} near ${attraction}`)
        addKeyword(`${intent} near ${attraction} in ${city}`)
        if (keywords.length >= targetCount) return keywords
      }
      if (keywords.length >= targetCount) return keywords
    }
  }

  for (const city of CITY_VARIATIONS) {
    for (const attraction of ATTRACTIONS) {
      for (const audience of AUDIENCE_TARGETS) {
        addKeyword(`best stay for ${audience} near ${attraction} in ${city}`)
        addKeyword(`affordable ${audience} accommodation in ${city}`)
        if (keywords.length >= targetCount) return keywords
      }
    }
  }

  return keywords
}

const LONG_TAIL_KEYWORDS = buildLongTailKeywords(LONG_TAIL_TARGET_COUNT)

function toSeoDescription(keyword: string, index: number) {
  const variants = [
    `Looking for ${keyword.toLowerCase()}? ${HOTEL_NAME} offers AC rooms, non-AC rooms, dormitory, dining hall and function hall in ${CITY} with instant online booking.`,
    `Book ${keyword.toLowerCase()} at ${HOTEL_NAME}. Enjoy clean rooms, free WiFi, parking, hot water and 24/7 support near key attractions.`,
    `${HOTEL_NAME} is a trusted choice for ${keyword.toLowerCase()} with affordable pricing, family-friendly stays and premium facilities in ${CITY}.`,
  ]
  return variants[index % variants.length]
}

function buildLandingPagesFromKeywords() {
  const pages: SeoPageDefinition[] = []
  const slugSeen = new Set<string>()

  LONG_TAIL_KEYWORDS.forEach((keyword, index) => {
    const slug = toSlug(keyword)
    if (!slug || RESERVED_SLUGS.has(slug) || slugSeen.has(slug)) return
    slugSeen.add(slug)
    const keywordTitle = toTitleCase(keyword)
    pages.push({
      slug,
      type: "landing",
      keyword: keywordTitle,
      title: `${keywordTitle} | ${HOTEL_NAME}`,
      description: toSeoDescription(keywordTitle, index),
    })
  })

  return pages
}

const LANDING_PAGES: SeoPageDefinition[] = buildLandingPagesFromKeywords()

export const SEO_PAGES: SeoPageDefinition[] = [...LANDING_PAGES, ...BLOG_PAGES]

export const SEO_PAGE_MAP = new Map(SEO_PAGES.map((page) => [page.slug, page]))

export function getSeoPageBySlug(slug: string) {
  return SEO_PAGE_MAP.get(slug)
}

export function getSeoLandingPages() {
  return LANDING_PAGES
}

export function getSeoBlogPages() {
  return BLOG_PAGES
}

export function getSeoSlugs() {
  return SEO_PAGES.map((page) => page.slug)
}

export function getLongTailKeywords() {
  return LONG_TAIL_KEYWORDS
}

export function getRelatedSeoPages(slug: string, limitCount = 8) {
  const current = getSeoPageBySlug(slug)
  if (!current) return [] as SeoPageDefinition[]
  const currentTokens = new Set(current.keyword.toLowerCase().split(/\s+/))
  return LANDING_PAGES.filter((page) => page.slug !== slug)
    .map((page) => {
      const tokens = page.keyword.toLowerCase().split(/\s+/)
      let score = 0
      tokens.forEach((token) => {
        if (currentTokens.has(token)) score += 1
      })
      return { page, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limitCount)
    .map((entry) => entry.page)
}

export function formatKeywordFromSlug(slug: string) {
  return titleFromSlug(slug)
}

