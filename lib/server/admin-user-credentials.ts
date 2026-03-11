import nodemailer from "nodemailer"
import { adminDb } from "@/lib/server/firebase-admin"

export function generateSecurePassword(length = 12) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
  const lower = "abcdefghijkmnopqrstuvwxyz"
  const digits = "23456789"
  const special = "!@#$%^&*()-_=+"
  const all = `${upper}${lower}${digits}${special}`

  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)]
  const password = [pick(upper), pick(lower), pick(digits), pick(special)]
  for (let index = password.length; index < Math.max(10, length); index += 1) {
    password.push(pick(all))
  }
  for (let index = password.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const tmp = password[index]
    password[index] = password[swapIndex]
    password[swapIndex] = tmp
  }
  return password.join("")
}

async function getSmtpConfig() {
  const smtpSnap = await adminDb.collection("secureSettings").doc("smtp").get()
  const smtp = (smtpSnap.data() || {}) as Record<string, unknown>
  const host = String(smtp.smtpHost || process.env.SMTP_HOST || "").trim()
  const port = Number(smtp.smtpPort || process.env.SMTP_PORT || 587)
  const secure = String(smtp.smtpSecure ?? process.env.SMTP_SECURE ?? "false").toLowerCase() === "true"
  const user = String(smtp.smtpUser || process.env.SMTP_USER || "").trim()
  const pass = String(
    smtp.smtpPass || smtp.smtpPassword || process.env.SMTP_PASS || process.env.SMTP_PASSWORD || ""
  ).trim()
  const fromName = String(smtp.smtpFromName || process.env.SMTP_FROM_NAME || "Anga Function Hall").trim()
  const fromEmail = String(smtp.smtpFromEmail || process.env.SMTP_FROM_EMAIL || user || "").trim()
  const appBaseUrl = String(smtp.appBaseUrl || process.env.APP_BASE_URL || "https://angafunctionhall.com").trim()
  if (!host || !user || !pass || !fromEmail) {
    throw new Error("SMTP_NOT_CONFIGURED")
  }
  return { host, port, secure, user, pass, fromName, fromEmail, appBaseUrl }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function sendAdminCreatedCredentialsEmail(params: {
  toEmail: string
  userName: string
  password: string
  userId?: string
}) {
  const smtp = await getSmtpConfig()
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  })
  // Do not hard-fail the flow on verify; some providers block verify while send still works.
  await transporter.verify().catch(() => undefined)
  const loginUrl = `${smtp.appBaseUrl.replace(/\/+$/, "")}/login`
  const subject = "Your Account Has Been Created - Anga Function Hall"
  const html = `
    <p>Hello ${params.userName || "User"},</p>
    <p>Your account has been successfully created by the administrator.</p>
    <p>You can now log in to the Anga Function Hall platform using the following credentials.</p>
    <p><strong>Email:</strong> ${params.toEmail}</p>
    <p><strong>Password:</strong> ${params.password}</p>
    <p><a href="${loginUrl}">Login here</a>: ${loginUrl}</p>
    <p>For security reasons, please change your password immediately after login.</p>
    <p>Thank you.<br/>Anga Function Hall Team</p>
  `

  let lastError = ""
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await transporter.sendMail({
        from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
        to: params.toEmail,
        subject,
        html,
      })
      await adminDb.collection("emailLogs").add({
        triggerEvent: "admin_user_credentials",
        userId: String(params.userId || ""),
        toEmail: params.toEmail,
        status: "SENT",
        messageId: String(response.messageId || ""),
        timestamp: new Date(),
      })
      return { ok: true as const }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "SMTP send failed"
      if (attempt < 3) {
        await delay(attempt * 1000)
      }
    }
  }
  await adminDb.collection("emailLogs").add({
    triggerEvent: "admin_user_credentials",
    userId: String(params.userId || ""),
    toEmail: params.toEmail,
    status: "FAILED",
    error: lastError || "Unknown SMTP error",
    timestamp: new Date(),
  })
  return { ok: false as const, error: lastError || "Email delivery failed" }
}
