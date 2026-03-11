import { createHash, randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import { FieldValue, Timestamp } from "firebase-admin/firestore"
import { adminAuth, adminDb } from "@/lib/server/firebase-admin"
import { sendPasswordResetEmail } from "@/lib/server/auth-email"

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string }
    const email = String(body.email || "").trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 })
    }

    let uid = ""
    try {
      const authUser = await adminAuth.getUserByEmail(email)
      uid = authUser.uid
    } catch (error) {
      const code = (error as { code?: string } | null)?.code
      if (code === "auth/user-not-found") {
        // Prevent email enumeration by returning success for unknown emails.
        return NextResponse.json({ ok: true })
      }
      throw error
    }

    const rawToken = randomBytes(32).toString("hex")
    const tokenHash = hashToken(rawToken)
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 60 * 60 * 1000))

    await adminDb.collection("passwordResetTokens").add({
      uid,
      email,
      tokenHash,
      usedAt: null,
      expiresAt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    await sendPasswordResetEmail(email, rawToken)

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send reset email."
    if (message === "SMTP_NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "SMTP is not configured. Please configure SMTP in admin settings." },
        { status: 500 }
      )
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
