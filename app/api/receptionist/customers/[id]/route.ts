import { NextResponse } from "next/server"
import { Timestamp } from "firebase-admin/firestore"
import { adminDb } from "@/lib/server/firebase-admin"
import { requirePermission, toHttpError } from "@/lib/server/permission-check"
import { updateCustomerSchema } from "@/lib/server/receptionist-schemas"
import { getRequestMeta, sanitizeText } from "@/lib/server/request-meta"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, "view_customers")
    const { id } = await params
    const customerSnap = await adminDb.collection("customers").doc(id).get()
    const userSnap = customerSnap.exists ? null : await adminDb.collection("users").doc(id).get()
    if (!customerSnap.exists && (!userSnap || !userSnap.exists)) {
      return NextResponse.json({ error: "Customer not found." }, { status: 404 })
    }
    const customer = customerSnap.exists
      ? {
          id: customerSnap.id,
          ...customerSnap.data(),
          source: "customers",
        }
      : {
          id,
          name: String(userSnap?.data()?.displayName || userSnap?.data()?.name || "Customer"),
          phone: String(userSnap?.data()?.phone || ""),
          email: String(userSnap?.data()?.email || ""),
          address: "",
          notes: "",
          isActive: userSnap?.data()?.isBlocked !== true,
          source: "users",
          role: String(userSnap?.data()?.role || "user"),
          createdAt: userSnap?.data()?.createdAt || null,
        }
    const bookingsSnap = await adminDb.collection("bookings").orderBy("createdAt", "desc").limit(300).get()
    const paymentsSnap = await adminDb.collection("payments").orderBy("createdAt", "desc").limit(300).get()
    const bookings = bookingsSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((item) => String(item.customerId || "") === id || String(item.userId || "") === id)
    const payments = paymentsSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((item) => String(item.customerId || "") === id || String(item.userId || "") === id)
    return NextResponse.json({
      customer,
      bookings,
      payments,
    })
  } catch (error) {
    const mapped = toHttpError(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { uid } = await requirePermission(request, "edit_customer")
    const meta = getRequestMeta(request)
    const { id } = await params
    const body = updateCustomerSchema.parse(await request.json())
    const updates: Record<string, unknown> = {
      updatedBy: uid,
      updatedAt: Timestamp.now(),
    }
    if (body.name !== undefined) updates.name = sanitizeText(body.name || "", 120)
    if (body.phone !== undefined) updates.phone = sanitizeText(body.phone || "", 20)
    if (body.email !== undefined) updates.email = sanitizeText(body.email || "", 200)
    if (body.address !== undefined) updates.address = sanitizeText(body.address || "", 300)
    if (body.notes !== undefined) updates.notes = sanitizeText(body.notes || "", 500)
    if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive)

    await adminDb.collection("customers").doc(id).set(updates, { merge: true })
    await adminDb.collection("auditLogs").add({
      entity: "customer",
      entityId: id,
      action: "UPDATE",
      message: "Updated customer",
      payload: { ...updates, ip: meta.ip, userAgent: meta.userAgent },
      createdBy: uid,
      createdAt: Timestamp.now(),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if ((error as { name?: string })?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid customer update payload." }, { status: 422 })
    }
    const mapped = toHttpError(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}
