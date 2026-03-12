 "use client"

import { MessageCircle } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { getSettings } from "@/lib/firebase-db"
import { DEFAULT_SETTINGS } from "@/lib/constants"

const DEFAULT_MESSAGE =
  "Hi Anga Function Hall, I would like to know more about booking details."

type WhatsAppFloatProps = {
  message?: string
}

export function WhatsAppFloat({ message = DEFAULT_MESSAGE }: WhatsAppFloatProps) {
  const [phoneDigits, setPhoneDigits] = useState(
    DEFAULT_SETTINGS.contactPhone.replace(/\D/g, "")
  )

  useEffect(() => {
    let mounted = true
    getSettings()
      .then((settings) => {
        if (!mounted) return
        const contactPhoneValue =
          String(settings.contactPhone || "").trim() || DEFAULT_SETTINGS.contactPhone
        const firstPhone =
          contactPhoneValue
            .split(/[\n,]+/)
            .map((item) => item.trim())
            .filter(Boolean)[0] || DEFAULT_SETTINGS.contactPhone
        const digits = firstPhone.replace(/\D/g, "")
        if (digits) {
          setPhoneDigits(digits)
        }
      })
      .catch(() => {
        // Keep default number fallback.
      })
    return () => {
      mounted = false
    }
  }, [])

  const href = useMemo(
    () => `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`,
    [message, phoneDigits]
  )

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat on WhatsApp"
      title="Chat on WhatsApp"
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-green-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-green-600"
    >
      <MessageCircle className="h-5 w-5" />
      WhatsApp
    </a>
  )
}
