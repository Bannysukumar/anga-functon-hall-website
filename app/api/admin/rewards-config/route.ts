import { NextResponse } from "next/server"
import { adminAuth, adminDb } from "@/lib/server/firebase-admin"

function readBearerToken(request: Request): string {
  const authHeader = request.headers.get("authorization") || ""
  if (!authHeader.startsWith("Bearer ")) return ""
  return authHeader.slice("Bearer ".length).trim()
}

async function ensureAdmin(request: Request) {
  const idToken = readBearerToken(request)
  if (!idToken) return { ok: false as const, status: 401, error: "Unauthorized" }
  const decoded = await adminAuth.verifyIdToken(idToken)
  const userSnap = await adminDb.collection("users").doc(decoded.uid).get()
  if (String(userSnap.data()?.role || "") !== "admin") {
    return { ok: false as const, status: 403, error: "Forbidden" }
  }
  return { ok: true as const, uid: decoded.uid }
}

export async function POST(request: Request) {
  try {
    const access = await ensureAdmin(request)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
    const body = (await request.json()) as { payload?: Record<string, unknown> }
    await adminDb.collection("settings").doc("rewards").set(body.payload || {}, { merge: true })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update rewards config" },
      { status: 500 }
    )
  }
}
