import { NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"
import { adminAuth, adminDb } from "@/lib/server/firebase-admin"

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
    await adminDb.collection("users").doc(decoded.uid).set(
      {
        forcePasswordChange: false,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update password flag" },
      { status: 500 }
    )
  }
}
