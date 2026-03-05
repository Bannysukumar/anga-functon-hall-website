export type WhatsAppSendResult = {
  status: "sent" | "failed" | "disabled"
  error?: string
}

function normalizePhone(phone: string) {
  const digits = String(phone || "").replace(/[^\d]/g, "")
  if (!digits) return ""
  if (digits.length === 10) return `91${digits}`
  return digits
}

export async function sendWhatsAppMessage(phone: string, message: string): Promise<WhatsAppSendResult> {
  const apiUrl = String(process.env.WHATSAPP_API_URL || "").trim()
  const apiToken = String(process.env.WHATSAPP_API_TOKEN || "").trim()
  const to = normalizePhone(phone)

  if (!apiUrl || !apiToken) {
    return { status: "disabled", error: "WhatsApp API is not configured." }
  }
  if (!to) {
    return { status: "failed", error: "Customer phone is missing." }
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ to, message }),
    })
    if (!response.ok) {
      const text = await response.text()
      return { status: "failed", error: text || "Failed to send WhatsApp message." }
    }
    return { status: "sent" }
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Failed to send WhatsApp message.",
    }
  }
}

export function buildBookingConfirmationMessage(input: {
  customerName: string
  eventDate: string
  hallName: string
}) {
  return [
    `Hello ${input.customerName}`,
    "",
    "Your booking at Anga Function Hall is confirmed.",
    "",
    `Event Date: ${input.eventDate}`,
    `Hall: ${input.hallName}`,
    "",
    "Thank you for choosing Anga Function Hall.",
  ].join("\n")
}

export function buildPaymentReminderMessage(input: {
  customerName: string
  eventDate: string
  remainingAmount: number
}) {
  return [
    `Hello ${input.customerName}`,
    "",
    "Payment reminder from Anga Function Hall.",
    "",
    `Event Date: ${input.eventDate}`,
    `Remaining Amount: INR ${Math.max(0, Number(input.remainingAmount || 0)).toLocaleString("en-IN")}`,
    "",
    "Please contact reception to complete your payment.",
  ].join("\n")
}
