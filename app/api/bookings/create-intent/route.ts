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

async function resolveBranchId(inputBranchId?: string, listingBranchId?: string) {
  const direct = String(inputBranchId || listingBranchId || "").trim()
  if (direct) return direct

  const activeBranchQuery = await adminDb
    .collection("branches")
    .where("isActive", "==", true)
    .limit(1)
    .get()
  if (!activeBranchQuery.empty) return activeBranchQuery.docs[0].id

  const anyBranchQuery = await adminDb.collection("branches").limit(1).get()
  if (!anyBranchQuery.empty) return anyBranchQuery.docs[0].id

  return ""
}

function isSlotBasedListing(type: string) {
  return ["function_hall", "open_function_hall", "dining_hall", "local_tour"].includes(
    String(type || "")
  )
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

    if (!body?.listingId || !body?.checkInDate) {
      return NextResponse.json(
        { error: "Missing required booking details." },
        { status: 400 }
      )
    }

    const [userSnap, listingSnap, settingsSnap, secureRazorpaySnap, walletSnap, campaignsSnap] = await Promise.all([
      adminDb.collection("users").doc(uid).get(),
      adminDb.collection("listings").doc(body.listingId).get(),
      adminDb.collection("settings").doc("global").get(),
      adminDb.collection("secureSettings").doc("razorpay").get(),
      adminDb.collection("userWallets").doc(uid).get(),
      adminDb.collection("campaigns").where("isActive", "==", true).get(),
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
    const minGuestCount = Math.max(1, Number(listing.minGuestCount || 1))
    const requestedGuestCount = Math.max(1, Number(body.guestCount || 1))
    if (requestedGuestCount < minGuestCount) {
      return NextResponse.json(
        { error: `Minimum ${minGuestCount} guest(s) required for this listing.` },
        { status: 400 }
      )
    }
    if (requestedGuestCount > Math.max(1, Number(listing.capacity || 1))) {
      return NextResponse.json(
        { error: "Guest count cannot exceed listing capacity." },
        { status: 400 }
      )
    }
    const checkOutDate = body.checkOutDate ? String(body.checkOutDate) : null
    if (!isSlotBasedListing(listing.type)) {
      if (!checkOutDate) {
        return NextResponse.json(
          { error: "Check-out date is required for stay bookings." },
          { status: 400 }
        )
      }
      const checkIn = new Date(`${body.checkInDate}T00:00:00`)
      const checkOut = new Date(`${checkOutDate}T00:00:00`)
      if (
        Number.isNaN(checkIn.getTime()) ||
        Number.isNaN(checkOut.getTime()) ||
        checkOut <= checkIn
      ) {
        return NextResponse.json(
          { error: "Check-out date must be after check-in date." },
          { status: 400 }
        )
      }
    }
    const branchIdToUse = await resolveBranchId(body.branchId, listing.branchId)
    if (!branchIdToUse) {
      return NextResponse.json(
        { error: "No branch is configured. Please create at least one branch in admin." },
        { status: 400 }
      )
    }
    if (body.branchId && listing.branchId && listing.branchId !== body.branchId) {
      return NextResponse.json(
        { error: "Listing-branch mismatch in request." },
        { status: 400 }
      )
    }
    if (!listing.branchId && branchIdToUse) {
      // Self-heal legacy listings created before branch mapping was mandatory.
      await listingSnap.ref.set(
        {
          branchId: branchIdToUse,
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      )
    }

    const settings = settingsSnap.exists
      ? ({ ...DEFAULT_SETTINGS, ...(settingsSnap.data() as Partial<SiteSettings>) } as SiteSettings)
      : DEFAULT_SETTINGS

    let couponId: string | null = null
    let couponDiscount = 0
    let couponCashback = 0
    const nowTs = Date.now()
    const activeCampaigns = campaignsSnap.docs
      .map((d) => d.data() as Record<string, any>)
      .filter((c) => {
        const start = Number(c.startDate?.toMillis?.() || 0)
        const end = Number(c.endDate?.toMillis?.() || 0)
        return (!start || start <= nowTs) && (!end || end >= nowTs)
      })
    const cashbackMultiplier = activeCampaigns.reduce(
      (max, c) => Math.max(max, Number(c.cashbackMultiplier || 1)),
      1
    )
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

      if (coupon.rewardMode === "cashback") {
        const cashbackValue = Number(coupon.cashbackValue || 0)
        const computedCashback =
          coupon.cashbackType === "percent"
            ? Math.round(basePreDiscount * (cashbackValue / 100))
            : Math.round(cashbackValue)
        const maxCashback = Math.max(0, Number(coupon.maxCashbackAmount || 0))
        couponCashback =
          maxCashback > 0
            ? Math.min(maxCashback, computedCashback)
            : computedCashback
        couponCashback = Math.round(couponCashback * cashbackMultiplier)
      } else {
        couponDiscount =
          coupon.discountType === "flat"
            ? Math.round(coupon.discountValue)
            : Math.round(basePreDiscount * (coupon.discountValue / 100))
      }
      couponId = coupon.id
    }

    const pricing = calculatePricing(listing, settings, body, couponDiscount)
    pricing.cashbackAmount = couponCashback
    const requestedWalletToUse = Math.max(0, Number(body.walletToUse || 0))
    const walletBalance = Math.max(0, Number(walletSnap.data()?.balance || 0))
    const walletApplied = Math.min(requestedWalletToUse, walletBalance, Math.max(0, pricing.amountToPay))
    pricing.walletApplied = walletApplied
    pricing.gatewayAmount = Math.max(0, pricing.amountToPay - walletApplied)
    pricing.amountToPay = pricing.gatewayAmount

    const secureRazorpay = secureRazorpaySnap.exists
      ? (secureRazorpaySnap.data() as { razorpaySecretKey?: string; razorpayKeyId?: string })
      : {}
    const razorpayKeyId = String(
      settings.razorpayKeyId ||
        secureRazorpay.razorpayKeyId ||
        process.env.RAZORPAY_KEY_ID ||
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
        ""
    ).trim()
    const razorpayKeySecret = String(
      secureRazorpay.razorpaySecretKey || process.env.RAZORPAY_KEY_SECRET || ""
    ).trim()
    if (pricing.amountToPay > 0 && (!razorpayKeyId || !razorpayKeySecret)) {
      const missing: string[] = []
      if (!razorpayKeyId) missing.push("Razorpay Key ID")
      if (!razorpayKeySecret) missing.push("Razorpay Secret Key")
      return NextResponse.json(
        {
          error: `Razorpay configuration missing: ${missing.join(", ")}. Update it in Admin > Settings.`,
        },
        { status: 500 }
      )
    }

    let orderId = ""
    let orderAmount = 0
    let orderCurrency = "INR"
    if (pricing.amountToPay > 0) {
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
      orderId = order.id
      orderAmount = Number(order.amount)
      orderCurrency = String(order.currency || "INR")
    }

    const intentRef = adminDb.collection("bookingIntents").doc()
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000))

    await intentRef.set({
      userId: uid,
      listingId: body.listingId,
      branchId: branchIdToUse,
      checkInDate: body.checkInDate,
      checkOutDate,
      slotId: body.slotId || null,
      slotName: body.slotName || null,
      guestCount: Math.max(1, Number(body.guestCount || 1)),
      unitsBooked: Math.max(1, Number(body.unitsBooked || 1)),
      selectedAddons: body.selectedAddons || [],
      couponCode: body.couponCode?.trim().toUpperCase() || null,
      couponId,
      pricing,
      razorpayOrderId: orderId || null,
      razorpayAmount: orderAmount,
      status: pricing.amountToPay > 0 ? "created" : "wallet_ready",
      createdAt: Timestamp.now(),
      expiresAt,
    })

    return NextResponse.json({
      intentId: intentRef.id,
      keyId: razorpayKeyId,
      orderId,
      amount: orderAmount,
      currency: orderCurrency,
      pricing,
      displayName: settings.razorpayDisplayName || "Anga Function Hall",
      expiresAt: expiresAt.toDate().toISOString(),
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create booking intent."
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
