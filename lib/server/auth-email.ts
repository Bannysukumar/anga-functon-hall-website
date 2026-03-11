import nodemailer from "nodemailer"
import { adminDb } from "@/lib/server/firebase-admin"

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
  const appBaseUrl = String(
    smtp.appBaseUrl || process.env.APP_BASE_URL || "https://angafunctionhall.com"
  )
    .trim()
    .replace(/\/+$/, "")

  if (!host || !user || !pass || !fromEmail) {
    throw new Error("SMTP_NOT_CONFIGURED")
  }

  return { host, port, secure, user, pass, fromName, fromEmail, appBaseUrl }
}

async function sendEmail(to: string, subject: string, html: string) {
  const smtp = await getSmtpConfig()
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  })
  await transporter.sendMail({
    from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
    to,
    subject,
    html,
  })
}

export async function sendSignupSuccessEmail(toEmail: string, userName: string) {
  await sendEmail(
    toEmail,
    "Welcome to Anga Function Hall",
    `
      <p>Hello ${userName || "User"},</p>
      <p>Your account has been created successfully.</p>
      <p>Welcome to Anga Function Hall.</p>
    `
  )
}

export async function sendPasswordResetEmail(toEmail: string, resetToken: string) {
  const smtp = await getSmtpConfig()
  const resetUrl = `${smtp.appBaseUrl}/reset-password?token=${encodeURIComponent(resetToken)}`
  await sendEmail(
    toEmail,
    "Reset Your Password",
    `
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
    `
  )
}
