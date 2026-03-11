import { NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"
import { adminAuth, adminDb } from "@/lib/server/firebase-admin"

const ALLOWED_ROLES = ["user", "staff", "receptionist", "cleaner", "watchman", "admin"] as const

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

function isValidIndianMobile(value: string) {
  return /^[6-9]\d{9}$/.test(value)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUid = await assertAdmin(request)
    const { id } = await params
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
      adminDb.collection("users").where("mobileNumber", "==", mobileNumber).limit(2).get(),
      adminDb.collection("users").where("phone", "==", mobileNumber).limit(2).get(),
    ])
    const duplicateDoc =
      existingMobile.docs.find((doc) => doc.id !== id) ||
      existingPhone.docs.find((doc) => doc.id !== id)
    if (duplicateDoc) {
      return NextResponse.json({ error: "This mobile number is already registered." }, { status: 409 })
    }

    await adminAuth.updateUser(id, { email, displayName: name })
    await adminDb.collection("users").doc(id).set(
      {
        email,
        displayName: name,
        phone: mobileNumber,
        mobileNumber,
        role,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    await adminDb.collection("mobileNumbers").doc(mobileNumber).set(
      {
        mobileNumber,
        userId: id,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    await adminDb.collection("auditLogs").add({
      entity: "user",
      entityId: id,
      action: "EDIT_USER",
      message: `Admin edited user ${email}`,
      payload: { role, mobileNumber },
      createdBy: adminUid,
      createdAt: FieldValue.serverTimestamp(),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update user"
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
