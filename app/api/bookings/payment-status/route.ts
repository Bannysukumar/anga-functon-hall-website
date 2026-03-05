import { NextResponse } from "next/server"
import { adminDb } from "@/lib/server/firebase-admin"

/**
 * GET /api/bookings/payment-status?orderId=razorpay_order_id
 * Returns intent/booking status so the frontend can show Payment Success/Failed after redirect (e.g. from UPI app).
 * No auth required; only returns status and bookingId when consumed.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get("orderId")?.trim()
    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 })
    }
    const snap = await adminDb
      .collection("bookingIntents")
      .where("razorpayOrderId", "==", orderId)
      .limit(1)
      .get()
    if (snap.empty) {
      return NextResponse.json({
        status: "not_found",
        message: "No booking intent found for this order.",
      })
    }
    const doc = snap.docs[0]
    const data = doc.data()
    const status = String(data?.status || "created")
    const bookingId = data?.bookingId ? String(data.bookingId) : undefined
    const invoiceNumber = data?.invoiceNumber
    let paymentStatus: "pending" | "paid" | "failed" = "pending"
    if (status === "consumed" && bookingId) paymentStatus = "paid"
    else if (status === "payment_failed") paymentStatus = "failed"

    const result: {
      status: string
      paymentStatus: "pending" | "paid" | "failed"
      bookingId?: string
      invoiceNumber?: string
      intentId?: string
    } = {
      status,
      paymentStatus,
    }
    if (bookingId) result.bookingId = bookingId
    if (invoiceNumber) result.invoiceNumber = String(invoiceNumber)
    result.intentId = doc.id

    if (status === "consumed" && bookingId) {
      const bookingSnap = await adminDb.collection("bookings").doc(bookingId).get()
      const booking = bookingSnap.data()
      if (booking?.invoiceNumber) result.invoiceNumber = String(booking.invoiceNumber)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[payment-status]", error)
    return NextResponse.json({ error: "Failed to get payment status" }, { status: 500 })
  }
}
