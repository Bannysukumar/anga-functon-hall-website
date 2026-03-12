import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { getLongTailKeywords } from "@/lib/seo/seo-pages"

export const metadata = {
  title: "SEO Long-Tail Keywords | Anga Function Hall",
  description:
    "Programmatic SEO keyword list for Anga Function Hall hotel and venue growth pages.",
}

export default function SeoKeywordsPage() {
  const keywords = getLongTailKeywords()

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="luxury-bg flex-1">
        <section className="mx-auto max-w-5xl px-4 py-12 lg:px-8">
          <div className="luxury-card rounded-3xl p-6 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
              SEO Keyword System
            </p>
            <h1 className="font-display mt-3 text-3xl text-foreground md:text-4xl">
              1000 Long-Tail Hotel Keywords
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Total generated keywords: <strong>{keywords.length}</strong>
            </p>
            <div className="mt-5 grid grid-cols-1 gap-2 rounded-2xl border bg-white p-4 sm:grid-cols-2">
              {keywords.map((keyword, index) => (
                <p key={`${keyword}-${index}`} className="text-sm text-foreground">
                  {index + 1}. {keyword}
                </p>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

