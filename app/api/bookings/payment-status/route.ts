import { NextResponse } from "next/server"
import { resolvePaymentByOrderId } from "@/lib/server/payment-status"

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
    const result = await resolvePaymentByOrderId(orderId)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[payment-status]", error)
    return NextResponse.json({ error: "Failed to get payment status" }, { status: 500 })
  }
}
