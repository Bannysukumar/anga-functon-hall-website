import { NextResponse } from "next/server"
import { Timestamp } from "firebase-admin/firestore"
import { adminDb } from "@/lib/server/firebase-admin"
import { requirePermission, toHttpError } from "@/lib/server/permission-check"
import { createPaymentSchema } from "@/lib/server/receptionist-schemas"
import { getRequestMeta, sanitizeText } from "@/lib/server/request-meta"

export async function GET(request: Request) {
  try {
    await requirePermission(request, "view_payments")
    const url = new URL(request.url)
    const limitCount = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 50)))
    const snap = await adminDb
      .collection("payments")
      .orderBy("createdAt", "desc")
      .limit(limitCount)
      .get()
    return NextResponse.json({
      items: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    })
  } catch (error) {
    const mapped = toHttpError(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}

export async function POST(request: Request) {
  try {
    const { uid } = await requirePermission(request, "create_payment_receipt")
    const meta = getRequestMeta(request)
    const body = createPaymentSchema.parse(await request.json())
    const amount = Number(body.amount)
    const bookingId = sanitizeText(body.bookingId || "", 120)
    const customerId = sanitizeText(body.customerId || "", 120)
    const method = sanitizeText(body.method || "cash", 40)
    const note = sanitizeText(body.note || "", 500)

    const ref = adminDb.collection("payments").doc()
    let linkedBookingId: string | null = null
    await adminDb.runTransaction(async (tx) => {
      let invoiceNumber = ""
      if (bookingId) {
        const bookingRef = adminDb.collection("bookings").doc(bookingId)
        const bookingSnap = await tx.get(bookingRef)
        if (bookingSnap.exists) {
          const booking = bookingSnap.data() || {}
          const totalAmount = Number(booking.totalAmount || 0)
          const advancePaid = Number(booking.advancePaid || 0) + amount
          const dueAmount = Math.max(0, totalAmount - advancePaid)
          invoiceNumber = String(booking.invoiceNumber || "")
          linkedBookingId = bookingId
          tx.set(
            bookingRef,
            {
              advancePaid,
              dueAmount,
              paymentStatus: dueAmount > 0 ? "advance_paid" : "fully_paid",
              updatedAt: Timestamp.now(),
            },
            { merge: true }
          )
        }
      }

      tx.set(ref, {
        bookingId: linkedBookingId,
        customerId: customerId || null,
        userId: uid,
        amount,
        totalAmount: amount,
        currency: "INR",
        method,
        note,
        status: "captured",
        gateway: "manual_receipt",
        verified: true,
        invoiceNumber: invoiceNumber || null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
    })

    await adminDb.collection("auditLogs").add({
      entity: "payment",
      entityId: ref.id,
      action: "CREATE_RECEIPT",
      message: "Created payment receipt",
      payload: {
        amount,
        bookingId: bookingId || null,
        customerId: customerId || null,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
      createdBy: uid,
      createdAt: Timestamp.now(),
    })

    return NextResponse.json({ id: ref.id, bookingLinked: Boolean(linkedBookingId) })
  } catch (error) {
    if ((error as { name?: string })?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid payment payload." }, { status: 422 })
    }
    const mapped = toHttpError(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}
