import { NextResponse } from "next/server"
import { Timestamp } from "firebase-admin/firestore"
import nodemailer from "nodemailer"
import { adminAuth, adminDb } from "@/lib/server/firebase-admin"
import { requirePermission, toHttpError } from "@/lib/server/permission-check"
import {
  createCustomerSchema,
  receptionistCustomersQuerySchema,
} from "@/lib/server/receptionist-schemas"
import { getRequestMeta, sanitizeText } from "@/lib/server/request-meta"

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
    subject: "Your login credentials - Anga Function Hall",
    html: `
      <p>Hello ${customerName || "Customer"},</p>
      <p>Your account has been created by the reception desk.</p>
      <p><strong>Login Email:</strong> ${toEmail}</p>
      <p><strong>Temporary Password:</strong> ${tempPassword}</p>
      <p>Please sign in and change your password using "Forgot password".</p>
    `,
  })
}

export async function GET(request: Request) {
  try {
    await requirePermission(request, "view_customers")
    const url = new URL(request.url)
    const rawQuery = {
      search: url.searchParams.get("search") || "",
      limit: url.searchParams.get("limit") || 20,
    }
    const parsed = receptionistCustomersQuerySchema.safeParse(rawQuery)
    const search = parsed.success ? parsed.data.search.toLowerCase() : String(rawQuery.search).toLowerCase()
    const parsedLimit = Number(rawQuery.limit)
    const limitCount = parsed.success
      ? parsed.data.limit
      : Number.isFinite(parsedLimit)
        ? Math.max(1, Math.min(300, Math.trunc(parsedLimit)))
        : 20

    const snap = await adminDb
      .collection("customers")
      .orderBy("updatedAt", "desc")
      .limit(200)
      .get()
    const usersSnap = await adminDb.collection("users").limit(300).get()

    const merged = new Map<string, Record<string, unknown>>()
    snap.docs.forEach((doc) => {
      const data = doc.data() || {}
      const name = String(data.name || "").trim()
      const phone = String(data.phone || "").trim()
      const email = String(data.email || "").trim()
      const mergeKey = (phone || email || doc.id).toLowerCase()
      merged.set(mergeKey, {
        id: doc.id,
        name,
        phone,
        email,
        address: String(data.address || ""),
        notes: String(data.notes || ""),
        isActive: data.isActive !== false,
        source: "customers",
      })
    })

    usersSnap.docs.forEach((doc) => {
      const data = doc.data() || {}
      const role = String(data.role || "user").toLowerCase()
      if (role === "admin" || role === "receptionist") return
      const name = String(data.displayName || data.name || "").trim()
      const phone = String(data.phone || "").trim()
      const email = String(data.email || "").trim()
      if (!name && !phone && !email) return
      const mergeKey = (phone || email || doc.id).toLowerCase()
      if (!merged.has(mergeKey)) {
        merged.set(mergeKey, {
          id: doc.id,
          name: name || "Customer",
          phone,
          email,
          address: "",
          notes: "",
          isActive: data.isBlocked !== true,
          source: "users",
        })
      }
    })

    let customers = Array.from(merged.values())
    if (search) {
      customers = customers.filter((customer) => {
        const name = String(customer.name || "").toLowerCase()
        const email = String(customer.email || "").toLowerCase()
        const phone = String(customer.phone || "").toLowerCase()
        return name.includes(search) || email.includes(search) || phone.includes(search)
      })
    }
    return NextResponse.json({
      items: customers.slice(0, limitCount),
      total: customers.length,
      hasMore: customers.length > limitCount,
    })
  } catch (error) {
    const mapped = toHttpError(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}

export async function POST(request: Request) {
  try {
    const { uid } = await requirePermission(request, "create_customer")
    const meta = getRequestMeta(request)
    const body = createCustomerSchema.parse(await request.json())
    const name = sanitizeText(body.name, 120)
    const phone = sanitizeText(body.phone, 20)
    const email = sanitizeText(body.email || "", 200).toLowerCase()
    const address = sanitizeText(body.address || "", 300)
    const notes = sanitizeText(body.notes || "", 500)

    let authUid = ""
    let tempPassword = ""
    try {
      const existing = await adminAuth.getUserByEmail(email)
      authUid = existing.uid
      throw new Error("EMAIL_ALREADY_REGISTERED")
    } catch (error) {
      const code = (error as { code?: string })?.code
      if (code && code !== "auth/user-not-found") {
        throw error
      }
      if (!code && error instanceof Error && error.message === "EMAIL_ALREADY_REGISTERED") {
        throw error
      }
      tempPassword = generateTempPassword()
      const authUser = await adminAuth.createUser({
        email,
        password: tempPassword,
        displayName: name,
      })
      authUid = authUser.uid
    }

    const customerRef = adminDb.collection("customers").doc(authUid)
    await adminDb.runTransaction(async (tx) => {
      tx.set(
        adminDb.collection("users").doc(authUid),
        {
          email,
          displayName: name,
          phone,
          photoURL: "",
          favorites: [],
          isBlocked: false,
          role: "user",
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      )
      tx.set(
        customerRef,
        {
          userId: authUid,
          name,
          phone,
          email,
          address,
          notes,
          isActive: true,
          createdBy: uid,
          updatedBy: uid,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      )
    })

    await sendCustomerCredentialEmail(email, name, tempPassword)

    await adminDb.collection("auditLogs").add({
      entity: "customer",
      entityId: customerRef.id,
      action: "CREATE",
      message: `Created customer ${name}`,
      payload: { name, phone, email },
      ip: meta.ip,
      userAgent: meta.userAgent,
      createdBy: uid,
      createdAt: Timestamp.now(),
    })

    return NextResponse.json({ id: customerRef.id, credentialsEmailSent: true })
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_ALREADY_REGISTERED") {
      return NextResponse.json(
        { error: "This email is already registered. Customer can log in or reset password." },
        { status: 409 }
      )
    }
    if (error instanceof Error && error.message === "SMTP_NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "SMTP is not configured. Set SMTP in Admin Settings to send credentials email." },
        { status: 500 }
      )
    }
    if ((error as { name?: string })?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid customer payload." }, { status: 422 })
    }
    const mapped = toHttpError(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}
