import { NextResponse } from "next/server"
import Razorpay from "razorpay"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const amount = Number(body?.amount)
    const receipt = String(body?.receipt || `order_${Date.now()}`)

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount for order creation." },
        { status: 400 }
      )
    }

    const razorpayKeyId =
      process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET

    if (!razorpayKeyId || !razorpayKeySecret) {
      return NextResponse.json(
        { error: "Razorpay server keys are not configured." },
        { status: 500 }
      )
    }

    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    })

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt,
      payment_capture: true,
    })

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: razorpayKeyId,
    })
  } catch {
    return NextResponse.json(
      { error: "Failed to create Razorpay order." },
      { status: 500 }
    )
  }
}
