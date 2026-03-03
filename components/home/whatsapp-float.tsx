import { MessageCircle } from "lucide-react"

const WHATSAPP_NUMBER = "919885555729"
const DEFAULT_MESSAGE =
  "Hi Anga Function Hall, I would like to know more about booking details."

type WhatsAppFloatProps = {
  message?: string
}

export function WhatsAppFloat({ message = DEFAULT_MESSAGE }: WhatsAppFloatProps) {
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`

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
