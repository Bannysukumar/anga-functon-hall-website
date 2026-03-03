"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Mail, MessageCircle } from "lucide-react"

type ContactFormCardProps = {
  email: string
  whatsappNumber: string
}

export function ContactFormCard({ email, whatsappNumber }: ContactFormCardProps) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [eventDate, setEventDate] = useState("")
  const [guests, setGuests] = useState("")
  const [message, setMessage] = useState("")

  const trimmedName = name.trim()
  const trimmedPhone = phone.trim()
  const trimmedMessage = message.trim()

  const compiledMessage = useMemo(() => {
    return [
      "Hello Anga Function Hall Team,",
      "",
      "I would like to enquire about a booking.",
      "",
      `Name: ${trimmedName || "-"}`,
      `Phone: ${trimmedPhone || "-"}`,
      `Event Date: ${eventDate || "-"}`,
      `Expected Guests: ${guests || "-"}`,
      "",
      "Message:",
      trimmedMessage || "-",
    ].join("\n")
  }, [trimmedName, trimmedPhone, eventDate, guests, trimmedMessage])

  const isValid = Boolean(trimmedName && trimmedPhone && trimmedMessage)

  function validateForm() {
    if (!isValid) {
      toast.error("Please fill Name, Phone, and Message.")
      return false
    }
    return true
  }

  function sendWhatsApp() {
    if (!validateForm()) return
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(compiledMessage)}`
    window.open(url, "_blank", "noopener,noreferrer")
    toast.success("Opening WhatsApp with your enquiry.")
  }

  function sendEmail() {
    if (!validateForm()) return
    const subject = `Booking enquiry from ${trimmedName}`
    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(compiledMessage)}`
    window.location.href = mailtoUrl
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Enquiry Form</CardTitle>
        <CardDescription>
          Share your event details and send directly via WhatsApp or Email.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-name">Full Name</Label>
          <Input
            id="contact-name"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-phone">Phone Number</Label>
          <Input
            id="contact-phone"
            placeholder="Enter your phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-date">Event Date</Label>
          <Input
            id="contact-date"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-guests">Expected Guests</Label>
          <Input
            id="contact-guests"
            type="number"
            min={1}
            placeholder="e.g. 300"
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="contact-message">Message</Label>
          <Textarea
            id="contact-message"
            placeholder="Tell us your requirements (event type, time, special setup, etc.)"
            className="min-h-28"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-3 md:col-span-2">
          <Button type="button" onClick={sendWhatsApp}>
            <MessageCircle />
            Send via WhatsApp
          </Button>
          <Button type="button" variant="outline" onClick={sendEmail}>
            <Mail />
            Send via Email
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
