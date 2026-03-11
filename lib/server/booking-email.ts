import { Timestamp } from "firebase-admin/firestore"
import nodemailer from "nodemailer"
import { adminDb } from "@/lib/server/firebase-admin"

type EmailKind =
  | "BOOKING_CREATED"
  | "BOOKING_CONFIRMATION"
  | "BOOKING_UPDATED"
  | "BOOKING_CHECKOUT"
  | "BOOKING_CANCELLED"

let smtpProbePromise: Promise<void> | null = null

async function getSmtpConfig() {
  const smtpSnap = await adminDb.collection("secureSettings").doc("smtp").get()
  const smtp = (smtpSnap.data() || {}) as Record<string, unknown>
  const host = String(smtp.smtpHost || process.env.SMTP_HOST || "").trim()
  const port = Number(smtp.smtpPort || process.env.SMTP_PORT || 587)
  const secure = String(smtp.smtpSecure ?? process.env.SMTP_SECURE ?? "false").toLowerCase() === "true"
  const user = String(smtp.smtpUser || process.env.SMTP_USER || "").trim()
  const pass = String(smtp.smtpPass || process.env.SMTP_PASS || process.env.SMTP_PASSWORD || "").trim()
  const fromName = String(smtp.smtpFromName || process.env.SMTP_FROM_NAME || "Anga Function Hall").trim()
  const fromEmail = String(smtp.smtpFromEmail || process.env.SMTP_FROM_EMAIL || user || "").trim()
  if (!host || !user || !pass || !fromEmail) {
    throw new Error("SMTP_NOT_CONFIGURED")
  }
  return { host, port, secure, user, pass, fromName, fromEmail }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function ensureSmtpProbe() {
  if (smtpProbePromise) {
    await smtpProbePromise
    return
  }
  smtpProbePromise = (async () => {
    try {
      const smtp = await getSmtpConfig()
      const transport = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: { user: smtp.user, pass: smtp.pass },
      })
      await transport.verify()
      console.info("[booking-email] SMTP connection verified")
    } catch (error) {
      console.error("[booking-email] SMTP connection probe failed", error)
    }
  })()
  await smtpProbePromise
}

function renderTemplate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.split(`{${key}}`).join(String(value))
  }, template)
}

function formatDate(value: unknown) {
  const date =
    typeof value === "string"
      ? new Date(value)
      : (value as { toDate?: () => Date } | null)?.toDate?.() || null
  if (!date || Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

async function writeEmailLog(data: {
  bookingId: string
  toEmail: string
  kind: EmailKind
  status: "SENT" | "FAILED" | "NOT_SENT"
  error?: string
  messageId?: string
}) {
  await adminDb.collection("emailLogs").add({
    ...data,
    timestamp: Timestamp.now(),
  })
}

async function sendWithRetry(input: {
  toEmail: string
  subject: string
  html: string
  bookingId: string
  kind: EmailKind
}) {
  const smtp = await getSmtpConfig()
  await ensureSmtpProbe()
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  })
  await transport.verify()

  let lastError = ""
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await transport.sendMail({
        from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
        to: input.toEmail,
        subject: input.subject,
        html: input.html,
      })
      await writeEmailLog({
        bookingId: input.bookingId,
        toEmail: input.toEmail,
        kind: input.kind,
        status: "SENT",
        messageId: String(result.messageId || ""),
      })
      return "sent" as const
    } catch (error) {
      lastError = error instanceof Error ? error.message : "SMTP send failed"
      if (attempt < 3) {
        await delay(attempt * 1000)
      }
    }
  }

  await writeEmailLog({
    bookingId: input.bookingId,
    toEmail: input.toEmail,
    kind: input.kind,
    status: "FAILED",
    error: lastError || "Unknown send error",
  })
  return "failed" as const
}

export async function sendBookingEmail(
  kind: EmailKind,
  bookingId: string,
  bookingData: Record<string, unknown>
) {
  const toEmail = String(bookingData.customerEmail || bookingData.email || "").trim()
  if (!toEmail) {
    await writeEmailLog({
      bookingId,
      toEmail: "",
      kind,
      status: "NOT_SENT",
      error: "Customer email missing",
    })
    return "failed" as const
  }

  const settingsSnap = await adminDb.collection("settings").doc("global").get()
  const settings = (settingsSnap.data() || {}) as Record<string, unknown>
  const values = {
    customerName: String(bookingData.customerName || "Customer"),
    bookingId,
    eventDate: formatDate(bookingData.checkInDate || bookingData.eventDate),
    hallName: String(bookingData.listingTitle || bookingData.hallName || "Anga Function Hall"),
    amount: Number(bookingData.totalAmount || 0).toLocaleString("en-IN"),
    bookingStatus: String(bookingData.status || "confirmed"),
    checkoutDate: formatDate(new Date()),
    paidAmount: Number(bookingData.advancePaid || 0).toLocaleString("en-IN"),
  }

  const defaults: Record<
    EmailKind,
    { subject: string; body: string }
  > = {
    BOOKING_CREATED: {
      subject: "Booking Created - Anga Function Hall",
      body: `
        <p>Hello {customerName},</p>
        <p>Your booking request has been created successfully.</p>
        <p><strong>Booking ID:</strong> {bookingId}</p>
        <p><strong>Event Date:</strong> {eventDate}</p>
        <p><strong>Hall/Room:</strong> {hallName}</p>
        <p><strong>Booking Amount:</strong> INR {amount}</p>
        <p><strong>Status:</strong> {bookingStatus}</p>
      `,
    },
    BOOKING_CONFIRMATION: {
      subject: "Your Booking Confirmation - Anga Function Hall",
      body: `
        <p>Hello {customerName},</p>
        <p>Your booking at Anga Function Hall is confirmed.</p>
        <p><strong>Booking ID:</strong> {bookingId}</p>
        <p><strong>Event Date:</strong> {eventDate}</p>
        <p><strong>Hall/Room:</strong> {hallName}</p>
        <p><strong>Booking Amount:</strong> INR {amount}</p>
        <p><strong>Status:</strong> {bookingStatus}</p>
      `,
    },
    BOOKING_UPDATED: {
      subject: "Booking Updated - Anga Function Hall",
      body: `
        <p>Hello {customerName},</p>
        <p>Your booking details have been updated.</p>
        <p><strong>Booking ID:</strong> {bookingId}</p>
        <p><strong>Event Date:</strong> {eventDate}</p>
        <p><strong>Hall/Room:</strong> {hallName}</p>
        <p><strong>Booking Amount:</strong> INR {amount}</p>
        <p><strong>Status:</strong> {bookingStatus}</p>
      `,
    },
    BOOKING_CHECKOUT: {
      subject: "Thank You for Choosing Anga Function Hall",
      body: `
        <p>Hello {customerName},</p>
        <p>Your booking has been checked out successfully.</p>
        <p><strong>Booking ID:</strong> {bookingId}</p>
        <p><strong>Event Date:</strong> {eventDate}</p>
        <p><strong>Checkout Date:</strong> {checkoutDate}</p>
        <p><strong>Total Amount Paid:</strong> INR {paidAmount}</p>
        <p>Thank you for choosing Anga Function Hall.</p>
      `,
    },
    BOOKING_CANCELLED: {
      subject: "Booking Cancellation Update - Anga Function Hall",
      body: `
        <p>Hello {customerName},</p>
        <p>Your booking has been marked as cancelled.</p>
        <p><strong>Booking ID:</strong> {bookingId}</p>
        <p><strong>Event Date:</strong> {eventDate}</p>
        <p><strong>Hall/Room:</strong> {hallName}</p>
        <p><strong>Status:</strong> cancelled</p>
      `,
    },
  }

  const templateSubject =
    kind === "BOOKING_CONFIRMATION"
      ? String(settings.bookingEmailSubjectTemplate || defaults.BOOKING_CONFIRMATION.subject)
      : kind === "BOOKING_CREATED"
        ? String(settings.bookingCreatedEmailSubjectTemplate || defaults.BOOKING_CREATED.subject)
      : kind === "BOOKING_CHECKOUT"
        ? String(settings.checkoutEmailSubjectTemplate || defaults.BOOKING_CHECKOUT.subject)
        : defaults[kind].subject
  const templateBody =
    kind === "BOOKING_CONFIRMATION"
      ? String(settings.bookingEmailHtmlTemplate || defaults.BOOKING_CONFIRMATION.body)
      : kind === "BOOKING_CREATED"
        ? String(settings.bookingCreatedEmailHtmlTemplate || defaults.BOOKING_CREATED.body)
      : kind === "BOOKING_CHECKOUT"
        ? String(settings.checkoutEmailHtmlTemplate || defaults.BOOKING_CHECKOUT.body)
        : defaults[kind].body

  const subject = renderTemplate(templateSubject, values)
  const html = renderTemplate(templateBody, values)
  try {
    return await sendWithRetry({ toEmail, subject, html, bookingId, kind })
  } catch (error) {
    if (error instanceof Error && error.message === "SMTP_NOT_CONFIGURED") {
      await writeEmailLog({
        bookingId,
        toEmail,
        kind,
        status: "NOT_SENT",
        error: "SMTP not configured",
      })
      return "pending" as const
    }
    await writeEmailLog({
      bookingId,
      toEmail,
      kind,
      status: "FAILED",
      error: error instanceof Error ? error.message : "Unexpected email error",
    })
    return "failed" as const
  }
}
