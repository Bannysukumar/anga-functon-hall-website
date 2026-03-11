import { NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"
import { adminAuth, adminDb } from "@/lib/server/firebase-admin"
import {
  generateSecurePassword,
  sendAdminCreatedCredentialsEmail,
} from "@/lib/server/admin-user-credentials"

function readBearerToken(request: Request): string {
  const authHeader = request.headers.get("authorization") || ""
  if (!authHeader.startsWith("Bearer ")) return ""
  return authHeader.slice("Bearer ".length).trim()
}

async function assertAdmin(request: Request) {
  const idToken = readBearerToken(request)
  if (!idToken) throw new Error("UNAUTHORIZED")
  const decoded = await adminAuth.verifyIdToken(idToken)
  const userSnap = await adminDb.collection("users").doc(decoded.uid).get()
  if (String(userSnap.data()?.role || "") !== "admin") throw new Error("FORBIDDEN")
  return decoded.uid
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUid = await assertAdmin(request)
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as { mode?: "resend" | "reset" }
    const mode = body.mode === "reset" ? "reset" : "resend"

    const userRef = adminDb.collection("users").doc(id)
    const userSnap = await userRef.get()
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found." }, { status: 404 })
    }
    const user = userSnap.data() || {}
    const email = String(user.email || "").trim().toLowerCase()
    const name = String(user.displayName || "User")
    if (!email) {
      return NextResponse.json({ error: "User email is missing." }, { status: 400 })
    }

    const generatedPassword = generateSecurePassword(12)
    await adminAuth.updateUser(id, { password: generatedPassword, email, displayName: name })
    await userRef.set(
      {
        forcePasswordChange: true,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )

    let emailSent = true
    let emailError = ""
    try {
      const result = await sendAdminCreatedCredentialsEmail({
        toEmail: email,
        userName: name,
        password: generatedPassword,
        userId: id,
      })
      emailSent = result.ok
      emailError = result.ok ? "" : String(result.error || "")
    } catch {
      emailSent = false
      emailError = "Email delivery failed."
    }

    await adminDb.collection("auditLogs").add({
      entity: "user",
      entityId: id,
      action: mode === "reset" ? "RESET_PASSWORD_BY_ADMIN" : "RESEND_CREDENTIALS_BY_ADMIN",
      message: `${mode === "reset" ? "Reset password" : "Resent credentials"} for ${email}`,
      payload: { email, emailSent },
      createdBy: adminUid,
      createdAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({
      ok: true,
      emailSent,
      warning: emailSent ? "" : `User created but email delivery failed. ${emailError}`.trim(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process credentials"
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
