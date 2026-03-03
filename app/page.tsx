import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { HeroSection } from "@/components/home/hero-section"
import { CategoryCards } from "@/components/home/category-cards"
import { FeaturedListings } from "@/components/home/featured-listings"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <CategoryCards />
        <FeaturedListings />
      </main>
      <Footer />
    </div>
  )
}
