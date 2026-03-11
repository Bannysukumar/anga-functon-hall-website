import { NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"
import { adminAuth, adminDb } from "@/lib/server/firebase-admin"

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUid = await assertAdmin(request)
    const { id } = await params
    const body = (await request.json()) as { isBlocked?: boolean }
    const isBlocked = Boolean(body.isBlocked)

    await adminDb.collection("users").doc(id).set(
      {
        isBlocked,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    await adminAuth.updateUser(id, { disabled: isBlocked }).catch(() => undefined)
    await adminDb.collection("auditLogs").add({
      entity: "user",
      entityId: id,
      action: isBlocked ? "DISABLE_USER" : "ENABLE_USER",
      message: isBlocked ? "Admin disabled user account" : "Admin enabled user account",
      payload: {},
      createdBy: adminUid,
      createdAt: FieldValue.serverTimestamp(),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update user status"
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
