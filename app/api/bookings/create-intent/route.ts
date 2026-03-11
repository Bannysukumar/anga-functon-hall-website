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

function isSingleBookingListing(type: string) {
  return ["function_hall", "open_function_hall", "dining_hall"].includes(String(type || ""))
}

function buildStayDateKeys(checkInDate: string, checkOutDate?: string | null) {
  const checkIn = new Date(`${checkInDate}T00:00:00`)
  const checkOut = checkOutDate ? new Date(`${checkOutDate}T00:00:00`) : new Date(`${checkInDate}T00:00:00`)
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) return [checkInDate]
  const keys: string[] = []
  if (checkOut > checkIn) {
    for (let cursor = new Date(checkIn); cursor < checkOut; cursor.setDate(cursor.getDate() + 1)) {
      keys.push(cursor.toISOString().slice(0, 10))
    }
  } else {
    keys.push(checkInDate)
  }
  return keys
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

    if (isSingleBookingListing(listing.type)) {
      const sameListingBookings = await adminDb
        .collection("bookings")
        .where("listingId", "==", body.listingId)
        .limit(300)
        .get()
      const hasConflict = sameListingBookings.docs.some((doc) => {
        const data = doc.data() || {}
        const status = String(data.status || "")
        if (["cancelled", "completed", "checked_out", "no_show"].includes(status)) return false
        const checkIn = data.checkInDate?.toDate?.() as Date | undefined
        const checkInKey = checkIn ? checkIn.toISOString().slice(0, 10) : ""
        return checkInKey === String(body.checkInDate)
      })
      if (hasConflict) {
        return NextResponse.json(
          { error: "This hall is already booked for the selected date." },
          { status: 409 }
        )
      }
    }

    const selectedRoomNumbers = Array.isArray(body.selectedRoomNumbers)
      ? body.selectedRoomNumbers.map((value) => String(value).trim()).filter(Boolean)
      : []
    if (listing.type === "room" && selectedRoomNumbers.length > 0) {
      const roomResourceId =
        String(listing.roomId || "").trim() &&
        !isSlotBasedListing(listing.type)
          ? String(listing.roomId || "").trim().toUpperCase()
          : String(body.listingId)
      const dateKeys = buildStayDateKeys(String(body.checkInDate), checkOutDate)
      const dateChunks: string[][] = []
      for (let index = 0; index < dateKeys.length; index += 30) {
        dateChunks.push(dateKeys.slice(index, index + 30))
      }
      const lockSnapshots = await Promise.all(
        dateChunks.map((chunk) =>
          adminDb
            .collection("availabilityLocks")
            .where("listingId", "==", roomResourceId)
            .where("date", "in", chunk)
            .get()
        )
      )
      const hasConflict = lockSnapshots.some((snapshot) =>
        snapshot.docs.some((doc) => {
          const lock = doc.data() || {}
          if (Boolean(lock.isBlocked)) return true
          const alreadyBooked = Array.isArray(lock.selectedRoomNumbers)
            ? (lock.selectedRoomNumbers as unknown[]).map((value) => String(value).trim())
            : []
          return selectedRoomNumbers.some((room) => alreadyBooked.includes(room))
        })
      )
      if (hasConflict) {
        return NextResponse.json(
          { error: "Selected room is already booked for the selected date." },
          { status: 409 }
        )
      }
    }

    const existingPendingQuery = await adminDb
      .collection("bookings")
      .where("userId", "==", uid)
      .where("listingId", "==", body.listingId)
      .where("status", "==", "pending")
      .limit(10)
      .get()
    const nowMs = Date.now()
    const sameDatePending = existingPendingQuery.docs.find((doc) => {
      const data = doc.data() || {}
      const pendingOrder = String(data.razorpayOrderId || "").trim()
      if (!pendingOrder) return false
      const expires = data.paymentExpiresAt?.toDate?.() as Date | undefined
      if (!expires || expires.getTime() < nowMs) return false
      const checkIn = data.checkInDate?.toDate?.() as Date | undefined
      const checkInKey = checkIn ? checkIn.toISOString().slice(0, 10) : ""
      return checkInKey === String(body.checkInDate)
    })
    if (sameDatePending) {
      return NextResponse.json(
        {
          error:
            "You already have a pending booking. Please complete payment or wait for confirmation.",
          bookingId: sameDatePending.id,
          orderId: String(sameDatePending.data()?.razorpayOrderId || ""),
        },
        { status: 409 }
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
    const bookingRef = pricing.amountToPay > 0 ? adminDb.collection("bookings").doc() : null
    const now = Timestamp.now()
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000))

    if (bookingRef) {
      const branchSnap = await adminDb.collection("branches").doc(branchIdToUse).get()
      const branchName = String(branchSnap.data()?.name || "")
      await bookingRef.set({
        userId: uid,
        customerEmail: String(userSnap.data()?.email || ""),
        listingId: body.listingId,
        roomId: String(listing.roomId || ""),
        roomNumber: String(listing.roomNumber || ""),
        roomTypeDetail: String(listing.roomTypeDetail || "ac") === "non_ac" ? "non_ac" : "ac",
        selectedRoomListingIds: Array.isArray(body.selectedRoomListingIds)
          ? body.selectedRoomListingIds.map((value) => String(value))
          : [],
        selectedRoomNumbers: Array.isArray(body.selectedRoomNumbers)
          ? body.selectedRoomNumbers.map((value) => String(value))
          : [],
        branchId: branchIdToUse,
        listingType: listing.type || "function_hall",
        listingTitle: listing.title || "Listing",
        branchName,
        checkInDate: Timestamp.fromDate(new Date(body.checkInDate)),
        checkOutDate: checkOutDate ? Timestamp.fromDate(new Date(checkOutDate)) : null,
        slotId: body.slotId || null,
        slotName: body.slotName || null,
        guestCount: Math.max(1, Number(body.guestCount || 1)),
        unitsBooked: Math.max(1, Number(body.unitsBooked || 1)),
        selectedAddons: body.selectedAddons || [],
        basePrice: Number(pricing.basePrice || 0),
        addonsTotal: Number(pricing.addonsTotal || 0),
        couponDiscount: Number(pricing.couponDiscount || 0),
        taxAmount: Number(pricing.taxAmount || 0),
        serviceFee: Number(pricing.serviceFee || 0),
        totalAmount: Number(pricing.totalAmount || 0),
        advancePaid: 0,
        dueAmount: Number(pricing.totalAmount || 0),
        remainingAmount: Number(pricing.totalAmount || 0),
        status: "pending",
        paymentStatus: "pending",
        razorpayOrderId: orderId || "",
        razorpayPaymentId: "",
        paymentMethod: "online",
        paymentExpiresAt: expiresAt,
        invoiceNumber: "",
        cancelledAt: null,
        refundAmount: 0,
        refundStatus: "none",
        createdAt: now,
        updatedAt: now,
      })
    }

    await intentRef.set({
      bookingId: bookingRef?.id || null,
      userId: uid,
      listingId: body.listingId,
      branchId: branchIdToUse,
      checkInDate: body.checkInDate,
      checkOutDate,
      slotId: body.slotId || null,
      slotName: body.slotName || null,
      guestCount: Math.max(1, Number(body.guestCount || 1)),
      unitsBooked: Math.max(1, Number(body.unitsBooked || 1)),
      selectedRoomListingIds: Array.isArray(body.selectedRoomListingIds)
        ? body.selectedRoomListingIds.map((value) => String(value))
        : [],
      selectedRoomNumbers: Array.isArray(body.selectedRoomNumbers)
        ? body.selectedRoomNumbers.map((value) => String(value))
        : [],
      selectedAddons: body.selectedAddons || [],
      couponCode: body.couponCode?.trim().toUpperCase() || null,
      couponId,
      pricing,
      razorpayOrderId: orderId || null,
      razorpayAmount: orderAmount,
      status: pricing.amountToPay > 0 ? "created" : "wallet_ready",
      createdAt: now,
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
