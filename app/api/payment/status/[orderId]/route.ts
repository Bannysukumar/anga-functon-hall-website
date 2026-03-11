import { NextResponse } from "next/server"
import { resolvePaymentByOrderId } from "@/lib/server/payment-status"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params
    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 })
    }
    const result = await resolvePaymentByOrderId(orderId)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get payment status." },
      { status: 500 }
    )
  }
}
