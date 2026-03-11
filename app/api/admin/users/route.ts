import { NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"
import { adminAuth, adminDb } from "@/lib/server/firebase-admin"
import {
  generateSecurePassword,
  sendAdminCreatedCredentialsEmail,
} from "@/lib/server/admin-user-credentials"

const ALLOWED_ROLES = ["user", "staff", "receptionist", "cleaner", "watchman", "admin"] as const

function readBearerToken(request: Request): string {
  const authHeader = request.headers.get("authorization") || ""
  if (!authHeader.startsWith("Bearer ")) return ""
  return authHeader.slice("Bearer ".length).trim()
}

function isValidIndianMobile(value: string) {
  return /^[6-9]\d{9}$/.test(value)
}

async function assertAdmin(request: Request) {
  const idToken = readBearerToken(request)
  if (!idToken) {
    throw new Error("UNAUTHORIZED")
  }
  const decoded = await adminAuth.verifyIdToken(idToken)
  const userSnap = await adminDb.collection("users").doc(decoded.uid).get()
  if (String(userSnap.data()?.role || "") !== "admin") {
    throw new Error("FORBIDDEN")
  }
  return decoded.uid
}

export async function POST(request: Request) {
  let createdUid = ""
  try {
    const adminUid = await assertAdmin(request)
    const body = (await request.json()) as {
      name?: string
      email?: string
      mobileNumber?: string
      role?: string
    }

    const name = String(body.name || "").trim()
    const email = String(body.email || "").trim().toLowerCase()
    const mobileNumber = String(body.mobileNumber || "").replace(/\D/g, "")
    const role = String(body.role || "user").trim().toLowerCase()

    if (!name || !email || !mobileNumber) {
      return NextResponse.json(
        { error: "Name, email and mobile number are required." },
        { status: 400 }
      )
    }
    if (!isValidIndianMobile(mobileNumber)) {
      return NextResponse.json(
        { error: "Enter a valid 10-digit Indian mobile number." },
        { status: 400 }
      )
    }
    if (!ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 })
    }

    const [existingMobile, existingPhone] = await Promise.all([
      adminDb.collection("users").where("mobileNumber", "==", mobileNumber).limit(1).get(),
      adminDb.collection("users").where("phone", "==", mobileNumber).limit(1).get(),
    ])
    if (!existingMobile.empty || !existingPhone.empty) {
      return NextResponse.json({ error: "This mobile number is already registered." }, { status: 409 })
    }

    try {
      await adminAuth.getUserByEmail(email)
      return NextResponse.json({ error: "This email is already registered." }, { status: 409 })
    } catch (error) {
      const code = (error as { code?: string })?.code
      if (code !== "auth/user-not-found") throw error
    }

    const generatedPassword = generateSecurePassword(12)
    const created = await adminAuth.createUser({
      email,
      password: generatedPassword,
      displayName: name,
      disabled: false,
    })
    createdUid = created.uid

    await adminDb.runTransaction(async (transaction) => {
      const userRef = adminDb.collection("users").doc(created.uid)
      const mobileRef = adminDb.collection("mobileNumbers").doc(mobileNumber)
      transaction.set(
        userRef,
        {
          email,
          displayName: name,
          phone: mobileNumber,
          mobileNumber,
          role,
          photoURL: "",
          favorites: [],
          isBlocked: false,
          forcePasswordChange: true,
          createdByAdminUid: adminUid,
          createdByAdminAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      transaction.set(
        mobileRef,
        {
          mobileNumber,
          userId: created.uid,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      transaction.set(adminDb.collection("auditLogs").doc(), {
        entity: "user",
        entityId: created.uid,
        action: "CREATE_BY_ADMIN",
        message: `Admin created user ${email}`,
        payload: { role, mobileNumber },
        createdBy: adminUid,
        createdAt: FieldValue.serverTimestamp(),
      })
    })

    let emailSent = true
    let emailError = ""
    try {
      const result = await sendAdminCreatedCredentialsEmail({
        toEmail: email,
        userName: name,
        password: generatedPassword,
        userId: created.uid,
      })
      emailSent = result.ok
      emailError = result.ok ? "" : String(result.error || "")
    } catch {
      emailSent = false
      emailError = "Email delivery failed."
    }

    return NextResponse.json({
      ok: true,
      userId: created.uid,
      emailSent,
      warning: emailSent ? "" : `User created but email delivery failed. ${emailError}`.trim(),
    })
  } catch (error) {
    if (createdUid) {
      await adminAuth.deleteUser(createdUid).catch(() => undefined)
    }
    const message = error instanceof Error ? error.message : "Failed to create user"
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
