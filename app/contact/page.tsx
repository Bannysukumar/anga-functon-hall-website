import type { Metadata } from "next"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { ContactFormCard } from "@/components/contact/contact-form-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Mail,
  MapPin,
  Phone,
  ExternalLink,
  Clock3,
  MessageCircle,
} from "lucide-react"

const MAP_DIRECTIONS_URL =
  "https://www.google.com/maps/dir/17.6661975,80.8820389//@17.6587978,80.8875853,15z/data=!3m1!4b1!4m4!4m3!1m1!4e1!1m0?entry=ttu&g_ep=EgoyMDI2MDMwMS4xIKXMDSoASAFQAw%3D%3D"
const MAP_EMBED_URL =
  "https://maps.google.com/maps?q=17.6587978,80.8875853&z=15&output=embed"
const PHONE_NUMBER = "+91 98855 55729"
const PHONE_LINK = "tel:+919885555729"
const EMAIL = "angafunctonhall@gmail.com"
const WHATSAPP_LINK = "https://wa.me/919885555729"
const WHATSAPP_NUMBER = "919885555729"

export const metadata: Metadata = {
  title: "Contact Us | Anga Function Hall",
  description:
    "Get in touch with Anga Function Hall for bookings, venue support, and directions.",
}

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-secondary/20">
        <section className="border-b bg-background">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-10 lg:px-8">
            <p className="text-sm font-medium text-primary">Contact Anga Function Hall</p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Plan your event with our team
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              Get quick help for venue booking, pricing, hall availability, and event
              planning support. Call, email, or visit us directly using map directions.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild>
                <a href={PHONE_LINK}>
                  <Phone />
                  Call Now
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href={`mailto:${EMAIL}`}>
                  <Mail />
                  Send Email
                </a>
              </Button>
              <Button variant="secondary" asChild>
                <Link href={MAP_DIRECTIONS_URL} target="_blank">
                  <MapPin />
                  Get Directions
                  <ExternalLink />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 lg:grid-cols-3 lg:px-8">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Phone</p>
                  <a href={PHONE_LINK} className="text-muted-foreground hover:text-primary">
                    {PHONE_NUMBER}
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Email</p>
                  <a
                    href={`mailto:${EMAIL}`}
                    className="break-all text-muted-foreground hover:text-primary"
                  >
                    {EMAIL}
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Address</p>
                  <p className="text-muted-foreground">Bhadrachalam, Telangana, India</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Support Hours</p>
                  <p className="text-muted-foreground">Mon - Sun: 9:00 AM - 9:00 PM</p>
                </div>
              </div>
              <div className="pt-2">
                <Button asChild className="w-full">
                  <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
                    <MessageCircle />
                    Chat on WhatsApp
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden lg:col-span-2">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Google Maps Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <iframe
                src={MAP_EMBED_URL}
                title="Anga Function Hall Location Map"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-[420px] w-full border-0"
              />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
                <p className="text-sm text-muted-foreground">
                  Use live map navigation to reach the venue quickly.
                </p>
                <Button variant="outline" asChild>
                  <Link href={MAP_DIRECTIONS_URL} target="_blank">
                    Open in Google Maps
                    <ExternalLink />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 pb-12 lg:px-8">
          <ContactFormCard email={EMAIL} whatsappNumber={WHATSAPP_NUMBER} />
        </section>
      </main>
      <Footer />
    </div>
  )
}
