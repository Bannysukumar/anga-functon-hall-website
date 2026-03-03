import { NextResponse } from "next/server"
import Razorpay from "razorpay"
import { Timestamp } from "firebase-admin/firestore"
import { adminAuth, adminDb } from "@/lib/server/firebase-admin"
import { DEFAULT_SETTINGS } from "@/lib/constants"
import {
  calculatePricing,
  type BookingIntentInput,
} from "@/lib/server/booking-pricing"
import type { Coupon, Listing, SiteSettings } from "@/lib/types"

function readBearerToken(request: Request): string {
  const authHeader = request.headers.get("authorization") || ""
  if (!authHeader.startsWith("Bearer ")) return ""
  return authHeader.slice("Bearer ".length).trim()
}

export async function POST(request: Request) {
  try {
    const idToken = readBearerToken(request)
    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const decoded = await adminAuth.verifyIdToken(idToken)
    const uid = decoded.uid
    const body = (await request.json()) as BookingIntentInput

    if (!body?.listingId || !body?.branchId || !body?.checkInDate) {
      return NextResponse.json(
        { error: "Missing required booking details." },
        { status: 400 }
      )
    }

    const [userSnap, listingSnap, settingsSnap] = await Promise.all([
      adminDb.collection("users").doc(uid).get(),
      adminDb.collection("listings").doc(body.listingId).get(),
      adminDb.collection("settings").doc("global").get(),
    ])

    if (!userSnap.exists) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 })
    }
    if (userSnap.data()?.isBlocked) {
      return NextResponse.json(
        { error: "Your account is blocked. Please contact support." },
        { status: 403 }
      )
    }
    if (!listingSnap.exists) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 })
    }

    const listing = listingSnap.data() as Listing
    if (!listing.isActive) {
      return NextResponse.json(
        { error: "This listing is currently unavailable." },
        { status: 400 }
      )
    }
    if (listing.branchId !== body.branchId) {
      return NextResponse.json(
        { error: "Listing-branch mismatch in request." },
        { status: 400 }
      )
    }

    const settings = settingsSnap.exists
      ? ({ ...DEFAULT_SETTINGS, ...(settingsSnap.data() as Partial<SiteSettings>) } as SiteSettings)
      : DEFAULT_SETTINGS

    let couponId: string | null = null
    let couponDiscount = 0
    if (body.couponCode?.trim()) {
      const code = body.couponCode.trim().toUpperCase()
      const couponQuery = await adminDb
        .collection("coupons")
        .where("code", "==", code)
        .where("isActive", "==", true)
        .limit(1)
        .get()

      if (couponQuery.empty) {
        return NextResponse.json(
          { error: "Invalid or inactive coupon." },
          { status: 400 }
        )
      }

      const couponDoc = couponQuery.docs[0]
      const coupon = { id: couponDoc.id, ...couponDoc.data() } as Coupon
      const now = new Date()
      const validFrom = coupon.validFrom?.toDate?.()
      const validUntil = coupon.validUntil?.toDate?.()

      if (validFrom && now < validFrom) {
        return NextResponse.json(
          { error: "This coupon is not yet active." },
          { status: 400 }
        )
      }
      if (validUntil && now > validUntil) {
        return NextResponse.json(
          { error: "This coupon has expired." },
          { status: 400 }
        )
      }
      if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
        return NextResponse.json(
          { error: "Coupon usage limit reached." },
          { status: 400 }
        )
      }

      const basePreDiscount = calculatePricing(listing, settings, body, 0).totalAmount
      if (coupon.minOrderAmount > 0 && basePreDiscount < coupon.minOrderAmount) {
        return NextResponse.json(
          {
            error: `Minimum order amount is INR ${coupon.minOrderAmount}.`,
          },
          { status: 400 }
        )
      }

      couponDiscount =
        coupon.discountType === "flat"
          ? Math.round(coupon.discountValue)
          : Math.round(basePreDiscount * (coupon.discountValue / 100))
      couponId = coupon.id
    }

    const pricing = calculatePricing(listing, settings, body, couponDiscount)
    if (pricing.amountToPay <= 0) {
      return NextResponse.json(
        { error: "Computed payable amount is invalid." },
        { status: 400 }
      )
    }

    const razorpayKeyId =
      process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET
    if (!razorpayKeyId || !razorpayKeySecret) {
      return NextResponse.json(
        { error: "Razorpay keys are not configured." },
        { status: 500 }
      )
    }

    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    })

    const amountInPaise = pricing.amountToPay * 100
    const receipt = `intent_${Date.now()}_${uid.slice(0, 6)}`
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt,
      payment_capture: true,
    })

    const intentRef = adminDb.collection("bookingIntents").doc()
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000))

    await intentRef.set({
      userId: uid,
      listingId: body.listingId,
      branchId: body.branchId,
      checkInDate: body.checkInDate,
      slotId: body.slotId || null,
      slotName: body.slotName || null,
      guestCount: Math.max(1, Number(body.guestCount || 1)),
      unitsBooked: Math.max(1, Number(body.unitsBooked || 1)),
      selectedAddons: body.selectedAddons || [],
      couponCode: body.couponCode?.trim().toUpperCase() || null,
      couponId,
      pricing,
      razorpayOrderId: order.id,
      razorpayAmount: order.amount,
      status: "created",
      createdAt: Timestamp.now(),
      expiresAt,
    })

    return NextResponse.json({
      intentId: intentRef.id,
      keyId: razorpayKeyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      pricing,
      displayName: settings.razorpayDisplayName || "VenueBook",
      expiresAt: expiresAt.toDate().toISOString(),
    })
  } catch {
    return NextResponse.json(
      { error: "Failed to create booking intent." },
      { status: 500 }
    )
  }
}
