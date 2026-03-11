import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { FieldValue, Timestamp } from "firebase-admin/firestore"
import bcrypt from "bcryptjs"
import { adminAuth, adminDb } from "@/lib/server/firebase-admin"

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      token?: string
      password?: string
      confirmPassword?: string
    }
    const token = String(body.token || "").trim()
    const password = String(body.password || "")
    const confirmPassword = String(body.confirmPassword || "")

    if (!token || !password || !confirmPassword) {
      return NextResponse.json({ error: "Token and password are required." }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 })
    }

    const tokenHash = hashToken(token)
    const tokenQuery = await adminDb
      .collection("passwordResetTokens")
      .where("tokenHash", "==", tokenHash)
      .limit(1)
      .get()

    if (tokenQuery.empty) {
      return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 })
    }

    const tokenDoc = tokenQuery.docs[0]
    const tokenData = tokenDoc.data() || {}
    const uid = String(tokenData.uid || "")
    const usedAt = tokenData.usedAt as { toDate?: () => Date } | null | undefined
    const expiresAt = tokenData.expiresAt as { toDate?: () => Date } | null | undefined

    if (!uid || usedAt?.toDate?.()) {
      return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 })
    }

    const expiresAtDate = expiresAt?.toDate?.()
    if (!expiresAtDate || expiresAtDate.getTime() < Date.now()) {
      return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 })
    }

    await adminAuth.updateUser(uid, { password })
    const passwordHash = await bcrypt.hash(password, 10)

    await adminDb.runTransaction(async (tx) => {
      tx.set(
        adminDb.collection("users").doc(uid),
        {
          forcePasswordChange: false,
          passwordHash,
          passwordUpdatedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      tx.set(
        tokenDoc.ref,
        {
          usedAt: Timestamp.now(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reset password." },
      { status: 500 }
    )
  }
}
