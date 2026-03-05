import { NextResponse } from "next/server"
import Razorpay from "razorpay"
import { adminDb } from "@/lib/server/firebase-admin"

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

    const [settingsSnap, secureSnap] = await Promise.all([
      adminDb.collection("settings").doc("global").get(),
      adminDb.collection("secureSettings").doc("razorpay").get(),
    ])
    const razorpayKeyId =
      String(settingsSnap.data()?.razorpayKeyId || "") ||
      process.env.RAZORPAY_KEY_ID ||
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
    const razorpayKeySecret =
      String(secureSnap.data()?.razorpaySecretKey || "") ||
      process.env.RAZORPAY_KEY_SECRET

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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create Razorpay order."
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
