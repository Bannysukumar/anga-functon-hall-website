import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { HeroSection } from "@/components/home/hero-section"
import { CategoryCards } from "@/components/home/category-cards"
import { FeaturedListings } from "@/components/home/featured-listings"
import { WhatsAppFloat } from "@/components/home/whatsapp-float"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main
        className="flex-1"
        style={{
          backgroundImage:
            'url("https://bhadradritemple.telangana.gov.in/images/sevasbackground.png")',
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed",
          backgroundPosition: "center top",
        }}
      >
        <HeroSection />
        <CategoryCards />
        <FeaturedListings />
      </main>
      <WhatsAppFloat />
      <Footer />
    </div>
  )
}
