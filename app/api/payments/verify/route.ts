import { NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"
import { Timestamp } from "firebase-admin/firestore"
import { adminAuth, adminDb } from "@/lib/server/firebase-admin"

function readBearerToken(request: Request): string {
  const authHeader = request.headers.get("authorization") || ""
  if (!authHeader.startsWith("Bearer ")) return ""
  return authHeader.slice("Bearer ".length).trim()
}

async function resolveRazorpaySecret(): Promise<string> {
  const secureSnap = await adminDb.collection("secureSettings").doc("razorpay").get()
  const secureSecret = String(secureSnap.data()?.razorpaySecretKey || "").trim()
  const envSecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim()
  return secureSecret || envSecret
}

export async function POST(request: Request) {
  try {
    const idToken = readBearerToken(request)
    if (!idToken) {
      return NextResponse.json(
        { verified: false, error: "Unauthorized" },
        { status: 401 }
      )
    }
    const decoded = await adminAuth.verifyIdToken(idToken)

    const body = await request.json()
    const intentId = String(body?.intentId || "")
    const razorpayOrderId = String(body?.razorpayOrderId || "")
    const razorpayPaymentId = String(body?.razorpayPaymentId || "")
    const razorpaySignature = String(body?.razorpaySignature || "")

    if (!intentId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json(
        { verified: false, error: "Missing Razorpay verification fields." },
        { status: 400 }
      )
    }

    const intentRef = adminDb.collection("bookingIntents").doc(intentId)
    const intentSnap = await intentRef.get()
    if (!intentSnap.exists) {
      return NextResponse.json(
        { verified: false, error: "Booking intent not found." },
        { status: 404 }
      )
    }

    const intent = intentSnap.data()
    if (intent?.userId !== decoded.uid) {
      return NextResponse.json(
        { verified: false, error: "Intent does not belong to this user." },
        { status: 403 }
      )
    }
    if (intent?.status === "consumed" && intent?.bookingId) {
      return NextResponse.json({ verified: true, bookingId: String(intent.bookingId) })
    }
    if (intent?.status !== "created" && intent?.status !== "verified") {
      return NextResponse.json(
        { verified: false, error: "Intent is not in payable state." },
        { status: 400 }
      )
    }
    if (intent?.razorpayOrderId !== razorpayOrderId) {
      return NextResponse.json(
        { verified: false, error: "Razorpay order mismatch." },
        { status: 400 }
      )
    }
    if (intent?.expiresAt?.toDate && new Date() > intent.expiresAt.toDate()) {
      return NextResponse.json(
        { verified: false, error: "Booking intent has expired." },
        { status: 400 }
      )
    }

    const razorpayKeySecret = await resolveRazorpaySecret()
    if (!razorpayKeySecret) {
      return NextResponse.json(
        { verified: false, error: "Razorpay secret key not configured." },
        { status: 500 }
      )
    }

    const payload = `${razorpayOrderId}|${razorpayPaymentId}`
    const expectedSignature = createHmac("sha256", razorpayKeySecret)
      .update(payload)
      .digest("hex")

    const expectedBuffer = Buffer.from(expectedSignature, "utf8")
    const receivedBuffer = Buffer.from(razorpaySignature, "utf8")
    const verified =
      expectedBuffer.length === receivedBuffer.length &&
      timingSafeEqual(expectedBuffer, receivedBuffer)

    if (verified) {
      await intentRef.update({
        status: "verified",
        razorpayPaymentId,
        verifiedAt: Timestamp.now(),
      })
    }

    return NextResponse.json({ verified })
  } catch {
    return NextResponse.json(
      { verified: false, error: "Failed to verify Razorpay signature." },
      { status: 500 }
    )
  }
}
