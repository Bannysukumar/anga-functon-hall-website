import { NextResponse } from "next/server"
import { Timestamp } from "firebase-admin/firestore"
import nodemailer from "nodemailer"
import { adminAuth, adminDb } from "@/lib/server/firebase-admin"
import { requirePermission, toHttpError } from "@/lib/server/permission-check"
import { getRequestMeta } from "@/lib/server/request-meta"

function generateTempPassword(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*"
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

async function sendCustomerCredentialEmail(
  toEmail: string,
  customerName: string,
  tempPassword: string
) {
  const smtpSnap = await adminDb.collection("secureSettings").doc("smtp").get()
  const smtp = (smtpSnap.data() || {}) as Record<string, unknown>
  const host = String(smtp.smtpHost || process.env.SMTP_HOST || "")
  const port = Number(smtp.smtpPort || process.env.SMTP_PORT || 587)
  const secure = String(smtp.smtpSecure ?? process.env.SMTP_SECURE ?? "false").toLowerCase() === "true"
  const user = String(smtp.smtpUser || process.env.SMTP_USER || "")
  const pass = String(smtp.smtpPass || process.env.SMTP_PASS || "")
  const fromName = String(smtp.smtpFromName || process.env.SMTP_FROM_NAME || "Anga Function Hall")
  const fromEmail = String(smtp.smtpFromEmail || process.env.SMTP_FROM_EMAIL || user || "")

  if (!host || !user || !pass || !fromEmail) {
    throw new Error("SMTP_NOT_CONFIGURED")
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  })

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: toEmail,
    subject: "Your new login credentials - Anga Function Hall",
    html: `
      <p>Hello ${customerName || "Customer"},</p>
      <p>Your temporary login password has been reset by the reception desk.</p>
      <p><strong>Login Email:</strong> ${toEmail}</p>
      <p><strong>Temporary Password:</strong> ${tempPassword}</p>
      <p>Please sign in and change your password using "Forgot password".</p>
    `,
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { uid } = await requirePermission(request, "edit_customer")
    const meta = getRequestMeta(request)
    const { id } = await params

    const customerRef = adminDb.collection("customers").doc(id)
    const customerSnap = await customerRef.get()
    const customer = customerSnap.exists ? customerSnap.data() || {} : {}

    const fallbackUserId = String(customer.userId || "")
    const userDocId = fallbackUserId || id
    const userRef = adminDb.collection("users").doc(userDocId)
    const userSnap = await userRef.get()
    const user = userSnap.exists ? userSnap.data() || {} : {}

    const email = String(customer.email || user.email || "").trim().toLowerCase()
    const name = String(customer.name || user.displayName || user.name || "Customer")
    if (!email) {
      return NextResponse.json({ error: "Customer email is missing." }, { status: 400 })
    }

    let authUid = fallbackUserId
    if (!authUid && userSnap.exists) {
      authUid = userDocId
    }
    if (!authUid) {
      try {
        const authUser = await adminAuth.getUserByEmail(email)
        authUid = authUser.uid
      } catch (error) {
        const code = (error as { code?: string })?.code
        if (code !== "auth/user-not-found") throw error
      }
    }

    const tempPassword = generateTempPassword()
    if (authUid) {
      await adminAuth.updateUser(authUid, {
        email,
        password: tempPassword,
        displayName: name,
      })
    } else {
      const created = await adminAuth.createUser({
        email,
        password: tempPassword,
        displayName: name,
      })
      authUid = created.uid
    }

    await adminDb.runTransaction(async (tx) => {
      tx.set(
        adminDb.collection("users").doc(authUid),
        {
          email,
          displayName: name,
          phone: String(customer.phone || user.phone || ""),
          photoURL: String(user.photoURL || ""),
          favorites: Array.isArray(user.favorites) ? user.favorites : [],
          isBlocked: user.isBlocked === true,
          role: String(user.role || "user"),
          updatedAt: Timestamp.now(),
          createdAt: user.createdAt || Timestamp.now(),
        },
        { merge: true }
      )
      tx.set(
        customerRef,
        {
          userId: authUid,
          email,
          name,
          updatedBy: uid,
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      )
    })

    await sendCustomerCredentialEmail(email, name, tempPassword)

    await adminDb.collection("auditLogs").add({
      entity: "customer",
      entityId: id,
      action: "RESEND_CREDENTIALS",
      message: "Resent customer login credentials",
      payload: { email, ip: meta.ip, userAgent: meta.userAgent },
      createdBy: uid,
      createdAt: Timestamp.now(),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === "SMTP_NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "SMTP is not configured. Set SMTP in Admin Settings to send credentials email." },
        { status: 500 }
      )
    }
    const mapped = toHttpError(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}
