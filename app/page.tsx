import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { HeroSection } from "@/components/home/hero-section"
import { CategoryCards } from "@/components/home/category-cards"
import { FeaturedListings } from "@/components/home/featured-listings"
import { FacilitiesSection } from "@/components/home/facilities-section"
import { PremiumGalleryPreview } from "@/components/home/premium-gallery-preview"
import { VirtualTourSection } from "@/components/home/virtual-tour-section"
import { TestimonialsSection } from "@/components/home/testimonials-section"
import { HotelStorySection } from "@/components/home/hotel-story-section"
import { ParallaxShowcaseSection } from "@/components/home/parallax-showcase-section"
import { LocationSection } from "@/components/home/location-section"
import { WhatsAppFloat } from "@/components/home/whatsapp-float"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <CategoryCards />
        <FeaturedListings />
        <HotelStorySection />
        <ParallaxShowcaseSection />
        <FacilitiesSection />
        <VirtualTourSection />
        <PremiumGalleryPreview />
        <TestimonialsSection />
        <LocationSection />
      </main>
      <WhatsAppFloat />
      <Footer />
    </div>
  )
}
