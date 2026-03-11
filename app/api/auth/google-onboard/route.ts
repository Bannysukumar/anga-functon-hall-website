import { NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"
import { adminAuth, adminDb } from "@/lib/server/firebase-admin"
import { sendSignupSuccessEmail } from "@/lib/server/auth-email"

function readBearerToken(request: Request): string {
  const authHeader = request.headers.get("authorization") || ""
  if (!authHeader.startsWith("Bearer ")) return ""
  return authHeader.slice("Bearer ".length).trim()
}

export async function POST(request: Request) {
  try {
    const idToken = readBearerToken(request)
    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const decoded = await adminAuth.verifyIdToken(idToken)
    const uid = decoded.uid
    const body = (await request.json().catch(() => ({}))) as {
      email?: string
      displayName?: string
      photoURL?: string
    }

    const email = String(body.email || decoded.email || "").trim().toLowerCase()
    const displayName = String(body.displayName || decoded.name || "User").trim() || "User"
    const photoURL = String(body.photoURL || decoded.picture || "").trim()

    if (!email) {
      return NextResponse.json({ error: "Email is required for Google sign-in." }, { status: 400 })
    }

    const userRef = adminDb.collection("users").doc(uid)
    const userSnap = await userRef.get()
    const existed = userSnap.exists
    const existing = userSnap.data() || {}

    await userRef.set(
      {
        email,
        displayName,
        phone: String(existing.phone || ""),
        mobileNumber: String(existing.mobileNumber || ""),
        photoURL: photoURL || String(existing.photoURL || ""),
        favorites: Array.isArray(existing.favorites) ? existing.favorites : [],
        isBlocked: Boolean(existing.isBlocked || false),
        role: String(existing.role || "user"),
        authProvider: "google",
        signupDate: existing.signupDate || FieldValue.serverTimestamp(),
        createdAt: existing.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )

    if (!existed) {
      sendSignupSuccessEmail(email, displayName).catch((error) => {
        console.error("[google-onboard] Failed to send signup success email", error)
      })
    }

    return NextResponse.json({ ok: true, existed })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Google onboarding failed" },
      { status: 500 }
    )
  }
}
