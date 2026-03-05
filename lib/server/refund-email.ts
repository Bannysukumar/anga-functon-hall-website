import { Timestamp } from "firebase-admin/firestore"
import nodemailer from "nodemailer"
import { adminDb } from "@/lib/server/firebase-admin"

export type RefundEmailKind = "REFUND_APPROVED" | "REFUND_REJECTED" | "REFUND_COMPLETED"

async function getSmtpConfig() {
  const smtpSnap = await adminDb.collection("secureSettings").doc("smtp").get()
  const smtp = (smtpSnap.data() || {}) as Record<string, unknown>
  const host = String(smtp.smtpHost || process.env.SMTP_HOST || "").trim()
  const port = Number(smtp.smtpPort || process.env.SMTP_PORT || 587)
  const secure = String(smtp.smtpSecure ?? process.env.SMTP_SECURE ?? "false").toLowerCase() === "true"
  const user = String(smtp.smtpUser || process.env.SMTP_USER || "").trim()
  const pass = String(smtp.smtpPass || process.env.SMTP_PASS || "").trim()
  const fromName = String(smtp.smtpFromName || process.env.SMTP_FROM_NAME || "Anga Function Hall").trim()
  const fromEmail = String(smtp.smtpFromEmail || process.env.SMTP_FROM_EMAIL || user || "").trim()
  if (!host || !user || !pass || !fromEmail) throw new Error("SMTP_NOT_CONFIGURED")
  return { host, port, secure, user, pass, fromName, fromEmail }
}

function renderTemplate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((result, [key, value]) => result.split(`{${key}}`).join(String(value)), template)
}

function formatDate(value: unknown) {
  const date =
    typeof value === "string"
      ? new Date(value)
      : (value as { toDate?: () => Date } | null)?.toDate?.() ?? null
  if (!date || Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export async function sendRefundEmail(
  kind: RefundEmailKind,
  bookingId: string,
  bookingData: Record<string, unknown>
) {
  const userId = String(bookingData.userId || "").trim()
  if (!userId) return "failed" as const
  const userSnap = await adminDb.collection("users").doc(userId).get()
  const user = userSnap.exists ? (userSnap.data() || {}) : {}
  const toEmail = String(user.email || bookingData.customerEmail || "").trim()
  if (!toEmail) return "failed" as const

  const customerName = String(user.displayName || user.name || "Customer").trim() || "Customer"
  const refundAmount = Number(bookingData.refundAmount || 0)
  const eventDate = formatDate(bookingData.checkInDate)
  const hallName = String(bookingData.listingTitle || "Anga Function Hall")

  const values: Record<string, string | number> = {
    customerName,
    bookingId,
    eventDate,
    hallName,
    refundAmount: refundAmount.toLocaleString("en-IN"),
  }

  const templates: Record<RefundEmailKind, { subject: string; body: string }> = {
    REFUND_APPROVED: {
      subject: "Refund Update – Anga Function Hall",
      body: `
        <p>Hello {customerName},</p>
        <p>Your refund request has been approved.</p>
        <p><strong>Booking ID:</strong> {bookingId}</p>
        <p><strong>Event Date:</strong> {eventDate}</p>
        <p><strong>Hall/Room:</strong> {hallName}</p>
        <p><strong>Refund Amount:</strong> ₹{refundAmount}</p>
        <p>The refund will be processed as per your original payment method.</p>
      `,
    },
    REFUND_REJECTED: {
      subject: "Refund Update – Anga Function Hall",
      body: `
        <p>Hello {customerName},</p>
        <p>Your refund request could not be approved.</p>
        <p><strong>Booking ID:</strong> {bookingId}</p>
        <p><strong>Event Date:</strong> {eventDate}</p>
        <p><strong>Hall/Room:</strong> {hallName}</p>
        <p>If you have questions, please contact us.</p>
      `,
    },
    REFUND_COMPLETED: {
      subject: "Refund Completed – Anga Function Hall",
      body: `
        <p>Hello {customerName},</p>
        <p>Your refund has been completed.</p>
        <p><strong>Booking ID:</strong> {bookingId}</p>
        <p><strong>Refund Amount:</strong> ₹{refundAmount}</p>
        <p>Thank you for choosing Anga Function Hall.</p>
      `,
    },
  }

  const { subject, body } = templates[kind]
  const html = renderTemplate(body, values)
  const subjectRendered = renderTemplate(subject, values)

  try {
    const smtp = await getSmtpConfig()
    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
    })
    await transport.sendMail({
      from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
      to: toEmail,
      subject: subjectRendered,
      html,
    })
    await adminDb.collection("emailLogs").add({
      bookingId,
      toEmail,
      kind,
      status: "SENT",
      timestamp: Timestamp.now(),
    })
    return "sent" as const
  } catch (error) {
    await adminDb.collection("emailLogs").add({
      bookingId,
      toEmail,
      kind,
      status: "FAILED",
      error: error instanceof Error ? error.message : "Send failed",
      timestamp: Timestamp.now(),
    })
    return "failed" as const
  }
}
