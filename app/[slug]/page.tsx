import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { getRelatedSeoPages, getSeoPageBySlug } from "@/lib/seo/seo-pages"
import { CheckCircle2 } from "lucide-react"

const HOTEL_NAME = "Anga Function Hall"
const HOTEL_ADDRESS = "Bhadrachalam, Bhadradri Kothagudem District, Telangana, India"
const HOTEL_PHONE = "+91 98855 55729"
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://angafunctionhall.com"
export const revalidate = 86400

const HOTEL_FEATURES = [
  "Free WiFi",
  "AC Rooms",
  "Non AC Rooms",
  "Dormitory",
  "Dining Hall",
  "Function Hall",
  "Parking",
  "24/7 Service",
]

const SEO_IMAGES = [
  {
    src: "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1400&auto=format&fit=crop",
    alt: "Hotel exterior view",
    label: "Hotel Exterior",
  },
  {
    src: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=1400&auto=format&fit=crop",
    alt: "Premium room interior",
    label: "Room Interior",
  },
  {
    src: "https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=1400&auto=format&fit=crop",
    alt: "Dining area",
    label: "Dining Hall",
  },
  {
    src: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=1400&auto=format&fit=crop",
    alt: "Function hall",
    label: "Function Hall",
  },
]

function buildHotelSchema(slug: string, title: string, description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Hotel",
    name: HOTEL_NAME,
    description,
    url: `${BASE_URL}/${slug}`,
    image: SEO_IMAGES.map((item) => item.src),
    telephone: "+91-98855-55729",
    priceRange: "₹585 - ₹5000",
    address: {
      "@type": "PostalAddress",
      streetAddress: HOTEL_ADDRESS,
      addressLocality: "Bhadrachalam",
      addressRegion: "Telangana",
      addressCountry: "India",
    },
    amenityFeature: HOTEL_FEATURES.map((name) => ({
      "@type": "LocationFeatureSpecification",
      name,
      value: true,
    })),
    sameAs: [
      `${BASE_URL}/gallery`,
      `${BASE_URL}/explore`,
      "https://www.google.com/maps/search/?api=1&query=Bhadrachalam,Telangana",
    ],
    potentialAction: {
      "@type": "ReserveAction",
      target: `${BASE_URL}/explore`,
      name: "Book Your Room",
    },
    headline: title,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.7",
      reviewCount: "328",
    },
  }
}

function buildBlogSchema(slug: string, title: string, description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description,
    author: {
      "@type": "Organization",
      name: HOTEL_NAME,
    },
    publisher: {
      "@type": "Organization",
      name: HOTEL_NAME,
    },
    image: SEO_IMAGES[0].src,
    mainEntityOfPage: `${BASE_URL}/${slug}`,
  }
}

function buildLocalBusinessSchema(slug: string) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: HOTEL_NAME,
    url: `${BASE_URL}/${slug}`,
    telephone: HOTEL_PHONE,
    address: {
      "@type": "PostalAddress",
      streetAddress: HOTEL_ADDRESS,
      addressLocality: "Bhadrachalam",
      addressRegion: "Telangana",
      addressCountry: "India",
    },
    image: SEO_IMAGES[0].src,
    priceRange: "₹585 - ₹5000",
  }
}

function buildFaqItems(keyword: string) {
  return [
    {
      question: `What is the best hotel option for ${keyword.toLowerCase()}?`,
      answer: `${HOTEL_NAME} offers AC rooms, non-AC rooms, family stays, dormitory, dining hall and function hall options with instant booking support in Bhadrachalam.`,
    },
    {
      question: `Does ${HOTEL_NAME} provide AC and Non-AC rooms?`,
      answer: `Yes. ${HOTEL_NAME} provides both AC and Non-AC room categories along with 24/7 service, parking and dining facilities.`,
    },
    {
      question: `Is ${HOTEL_NAME} near Bhadrachalam temple and transport points?`,
      answer: `Yes, the property is conveniently located for temple visitors and is accessible from local bus and railway routes around Bhadrachalam.`,
    },
    {
      question: `How can I book a room at ${HOTEL_NAME}?`,
      answer: `You can check availability online, select your dates and complete booking from the Explore page with secure checkout.`,
    },
  ]
}

function buildFaqSchema(faqItems: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  }
}

function buildReviewSchema(slug: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Review",
    itemReviewed: {
      "@type": "Hotel",
      name: HOTEL_NAME,
      url: `${BASE_URL}/${slug}`,
    },
    author: {
      "@type": "Person",
      name: "Guest Review",
    },
    reviewRating: {
      "@type": "Rating",
      ratingValue: "5",
      bestRating: "5",
    },
    reviewBody:
      "Great stay experience with clean rooms, friendly service, and easy booking in Bhadrachalam.",
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const page = getSeoPageBySlug(slug)
  if (!page) return {}
  const canonical = `${BASE_URL}/${slug}`
  return {
    title: page.title,
    description: page.description,
    alternates: {
      canonical,
    },
    openGraph: {
      title: page.title,
      description: page.description,
      url: canonical,
      type: "website",
      images: SEO_IMAGES.map((item) => item.src),
    },
  }
}

export default async function SeoLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const page = getSeoPageBySlug(slug)
  if (!page) {
    notFound()
  }

  const schema =
    page.type === "blog"
      ? buildBlogSchema(page.slug, page.title, page.description)
      : buildHotelSchema(page.slug, page.title, page.description)
  const faqItems = buildFaqItems(page.keyword)
  const relatedPages = getRelatedSeoPages(page.slug, 8)
  const schemaGraph = [
    schema,
    buildLocalBusinessSchema(page.slug),
    buildFaqSchema(faqItems),
    buildReviewSchema(page.slug),
  ]

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="luxury-bg flex-1">
        <section className="mx-auto max-w-6xl px-4 py-12 lg:px-8">
          <div className="luxury-card rounded-3xl p-6 md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
              {page.type === "blog" ? "Travel Blog" : "Hotel Booking Guide"}
            </p>
            <h1 className="font-display mt-3 text-3xl leading-tight text-foreground md:text-5xl">
              {page.keyword}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-base">
              {page.description}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="rounded-full bg-amber-500 text-amber-950 hover:bg-amber-400">
                <Link href="/explore">Book Your Room</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/explore">Check Availability</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/gallery">View Gallery</Link>
              </Button>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {SEO_IMAGES.map((item) => (
              <div key={item.label} className="overflow-hidden rounded-2xl border bg-white">
                <img
                  src={item.src}
                  alt={item.alt}
                  loading="lazy"
                  width={900}
                  height={620}
                  className="h-52 w-full object-cover md:h-64"
                />
                <p className="px-3 py-2 text-xs font-medium text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>

          {page.type === "landing" ? (
            <section className="mt-8 grid gap-5 rounded-2xl border bg-white/90 p-6 md:grid-cols-[1fr_0.9fr]">
              <div>
                <h2 className="font-display text-2xl text-foreground">Why choose {HOTEL_NAME}?</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Looking for {page.keyword.toLowerCase()}? {HOTEL_NAME} offers clean, comfortable and budget-friendly
                  stays with premium facilities in {HOTEL_ADDRESS}. We are ideal for families, pilgrims and event
                  guests visiting Bhadrachalam.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {HOTEL_FEATURES.map((feature) => (
                    <p key={feature} className="inline-flex items-center gap-2 text-sm text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      {feature}
                    </p>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border bg-muted/40 p-4">
                <h3 className="font-semibold text-foreground">Room Price & Booking</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  AC and Non-AC rooms available from <strong>₹585 per night</strong> with instant confirmation.
                </p>
                <div className="mt-4 space-y-2">
                  <Button asChild className="w-full bg-amber-500 text-amber-950 hover:bg-amber-400">
                    <Link href="/explore">Reserve Now</Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/contact">Contact for Group Booking</Link>
                  </Button>
                </div>
              </div>
            </section>
          ) : (
            <article className="mt-8 rounded-2xl border bg-white/90 p-6">
              <h2 className="font-display text-2xl text-foreground">Travel Information</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {page.keyword} can help visitors plan a smoother trip by choosing the right season, nearby places and
                family-friendly accommodation. Our hotel recommendation focuses on comfort, location convenience and
                value for money.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                For pilgrims and families, booking rooms in advance is the best approach during festive dates. If you
                are traveling in a group, dormitory and hall options provide better flexibility.
              </p>
              <div className="mt-5">
                <Button asChild className="rounded-full bg-amber-500 text-amber-950 hover:bg-amber-400">
                  <Link href="/explore">Book Recommended Stay</Link>
                </Button>
              </div>
            </article>
          )}

          <section className="mt-8 rounded-2xl border bg-white/90 p-6">
            <h3 className="font-semibold text-foreground">Quick Links</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link className="rounded-full border px-3 py-1.5 text-sm hover:bg-muted" href="/">
                Home
              </Link>
              <Link className="rounded-full border px-3 py-1.5 text-sm hover:bg-muted" href="/explore?type=room">
                Rooms
              </Link>
              <Link className="rounded-full border px-3 py-1.5 text-sm hover:bg-muted" href="/gallery">
                Gallery
              </Link>
              <Link className="rounded-full border px-3 py-1.5 text-sm hover:bg-muted" href="/contact">
                Contact
              </Link>
              <Link className="rounded-full border px-3 py-1.5 text-sm hover:bg-muted" href="/explore">
                Booking
              </Link>
            </div>
          </section>

          <section className="mt-8 grid gap-5 rounded-2xl border bg-white/90 p-6 md:grid-cols-[1fr_1fr]">
            <div>
              <h3 className="font-semibold text-foreground">Hotel Location & NAP</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                <strong>{HOTEL_NAME}</strong>
                <br />
                {HOTEL_ADDRESS}
                <br />
                Phone: {HOTEL_PHONE}
              </p>
              <Button asChild className="mt-4 rounded-full bg-amber-500 text-amber-950 hover:bg-amber-400">
                <Link href="/explore">Check Availability</Link>
              </Button>
            </div>
            <div className="overflow-hidden rounded-xl border">
              <iframe
                title={`${HOTEL_NAME} map`}
                src="https://www.google.com/maps?q=17.6661975,80.8820389&z=16&output=embed"
                className="h-60 w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </section>

          <section className="mt-8 rounded-2xl border bg-white/90 p-6">
            <h3 className="font-semibold text-foreground">Frequently Asked Questions</h3>
            <div className="mt-4 space-y-3">
              {faqItems.map((item) => (
                <details key={item.question} className="rounded-xl border bg-background p-3">
                  <summary className="cursor-pointer text-sm font-medium text-foreground">
                    {item.question}
                  </summary>
                  <p className="mt-2 text-sm text-muted-foreground">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>

          {relatedPages.length > 0 ? (
            <section className="mt-8 rounded-2xl border bg-white/90 p-6">
              <h3 className="font-semibold text-foreground">Related Hotel Search Pages</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {relatedPages.map((related) => (
                  <Link
                    key={related.slug}
                    href={`/${related.slug}`}
                    className="rounded-full border px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    {related.keyword}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </section>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaGraph) }}
      />
      <Footer />
    </div>
  )
}

