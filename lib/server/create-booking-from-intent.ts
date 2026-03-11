import { Timestamp } from "firebase-admin/firestore"
import { adminDb } from "@/lib/server/firebase-admin"

function generateInvoiceNumber(): string {
  const now = new Date()
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `INV-${dateStr}-${rand}`
}

/**
 * Creates a booking from a verified intent. Used by finalize (frontend) and webhook (payment.captured).
 * Intent must already have status "verified" and razorpayPaymentId set.
 */
export async function createBookingFromIntent(
  intentId: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  userId: string
): Promise<{ bookingId: string; invoiceNumber: string; totalAmount: number; advancePaid: number }> {
  const result = await adminDb.runTransaction(async (transaction) => {
    const intentRef = adminDb.collection("bookingIntents").doc(intentId)
    const intentSnap = await transaction.get(intentRef)
    if (!intentSnap.exists) throw new Error("Booking intent not found.")
    const intent = intentSnap.data()
    if (!intent) throw new Error("Booking intent payload is missing.")
    if (intent.userId !== userId) throw new Error("Intent does not belong to this user.")
    if (intent.status === "consumed" && intent.bookingId) {
      const bookingSnap = await transaction.get(adminDb.collection("bookings").doc(intent.bookingId))
      if (bookingSnap.exists) {
        const b = bookingSnap.data()
        return {
          bookingId: intent.bookingId,
          invoiceNumber: b?.invoiceNumber || "",
          totalAmount: Number(b?.totalAmount || 0),
          advancePaid: Number(b?.advancePaid || 0),
        }
      }
    }
    if (intent.status !== "verified") throw new Error("Payment is not verified for this intent.")
    if (intent.razorpayOrderId !== razorpayOrderId) throw new Error("Razorpay order mismatch.")
    if (intent.razorpayPaymentId !== razorpayPaymentId) throw new Error("Razorpay payment mismatch.")
    if (intent.expiresAt?.toDate && new Date() > intent.expiresAt.toDate()) {
      throw new Error("Booking intent has expired.")
    }

    const [userSnap, listingSnap, branchSnap] = await Promise.all([
      transaction.get(adminDb.collection("users").doc(userId)),
      transaction.get(adminDb.collection("listings").doc(intent.listingId)),
      transaction.get(adminDb.collection("branches").doc(intent.branchId)),
    ])
    if (!userSnap.exists) throw new Error("User not found.")
    if (userSnap.data()?.isBlocked) throw new Error("Blocked user cannot book.")
    if (!listingSnap.exists) throw new Error("Listing not found.")
    if (!branchSnap.exists) throw new Error("Branch not found.")

    const listing = listingSnap.data()
    const pricing = intent.pricing || {}
    const minGuestCount = Math.max(1, Number(listing?.minGuestCount || 1))
    const guestCount = Math.max(1, Number(intent.guestCount || 1))
    if (guestCount < minGuestCount) throw new Error(`Minimum ${minGuestCount} guest(s) required.`)
    const slotId = intent.slotId || "fullday"
    const roomResourceId =
      String(listing?.roomId || "").trim() &&
      !["function_hall", "open_function_hall", "dining_hall", "local_tour"].includes(String(listing?.type || ""))
        ? String(listing?.roomId || "").trim().toUpperCase()
        : String(intent.listingId)
    const lockDocId = `${roomResourceId}_${intent.checkInDate}_${slotId}`
    const lockRef = adminDb.collection("availabilityLocks").doc(lockDocId)
    const lockSnap = await transaction.get(lockRef)
    const maxUnits = listing?.inventory || 1
    const unitsNeeded = Math.max(1, Number(intent.unitsBooked || 1))
    const selectedRoomNumbers = Array.isArray(intent.selectedRoomNumbers)
      ? intent.selectedRoomNumbers.map((value: unknown) => String(value).trim()).filter(Boolean)
      : []
    let currentBooked = 0
    if (lockSnap.exists) {
      const lock = lockSnap.data()
      if (lock?.isBlocked) throw new Error("This slot/date is blocked.")
      currentBooked = Number(lock?.bookedUnits || 0)
      const alreadyBookedRoomNumbers = new Set(
        Array.isArray(lock?.selectedRoomNumbers)
          ? (lock.selectedRoomNumbers as unknown[]).map((value) => String(value).trim())
          : []
      )
      const hasRoomConflict = selectedRoomNumbers.some((room) => alreadyBookedRoomNumbers.has(room))
      if (hasRoomConflict) {
        throw new Error("Selected room is already booked for this date.")
      }
    }
    if (currentBooked + unitsNeeded > maxUnits) {
      throw new Error(`Not enough availability. Only ${Math.max(0, maxUnits - currentBooked)} unit(s) remaining.`)
    }

    const existingBookingId = String(intent.bookingId || "")
    const bookingRef = existingBookingId
      ? adminDb.collection("bookings").doc(existingBookingId)
      : adminDb.collection("bookings").doc()
    const paymentRef = adminDb.collection("payments").doc()
    const now = Timestamp.now()
    const invoiceNumber = generateInvoiceNumber()

    if (lockSnap.exists) {
      const previousRoomNumbers = Array.isArray(lockSnap.data()?.selectedRoomNumbers)
        ? (lockSnap.data()?.selectedRoomNumbers as unknown[]).map((value) => String(value).trim()).filter(Boolean)
        : []
      transaction.update(lockRef, {
        bookedUnits: currentBooked + unitsNeeded,
        selectedRoomNumbers: Array.from(new Set([...previousRoomNumbers, ...selectedRoomNumbers])),
        bookingIds: [...(lockSnap.data()?.bookingIds || []), bookingRef.id],
        updatedAt: now,
      })
    } else {
      transaction.set(lockRef, {
        listingId: roomResourceId,
        date: intent.checkInDate,
        slotId,
        bookedUnits: unitsNeeded,
        maxUnits,
        selectedRoomNumbers,
        bookingIds: [bookingRef.id],
        isBlocked: false,
        updatedAt: now,
      })
    }

    transaction.set(bookingRef, {
      userId,
      customerEmail: String(userSnap.data()?.email || ""),
      listingId: intent.listingId,
      roomId: String(listing?.roomId || ""),
      roomNumber: String(listing?.roomNumber || ""),
      roomTypeDetail: String(listing?.roomTypeDetail || "ac") === "non_ac" ? "non_ac" : "ac",
      selectedRoomListingIds: Array.isArray(intent.selectedRoomListingIds)
        ? intent.selectedRoomListingIds.map((value: unknown) => String(value))
        : [],
      selectedRoomNumbers,
      branchId: intent.branchId,
      listingType: listing?.type || "function_hall",
      listingTitle: listing?.title || "Listing",
      branchName: branchSnap.data()?.name || "",
      checkInDate: Timestamp.fromDate(new Date(intent.checkInDate)),
      checkOutDate: intent.checkOutDate ? Timestamp.fromDate(new Date(intent.checkOutDate)) : null,
      slotId: intent.slotId || null,
      slotName: intent.slotName || null,
      guestCount,
      unitsBooked: unitsNeeded,
      selectedAddons: intent.selectedAddons || [],
      basePrice: Number(pricing.basePrice || 0),
      addonsTotal: Number(pricing.addonsTotal || 0),
      couponDiscount: Number(pricing.couponDiscount || 0),
      taxAmount: Number(pricing.taxAmount || 0),
      serviceFee: Number(pricing.serviceFee || 0),
      totalAmount: Number(pricing.totalAmount || 0),
      advancePaid: Number(pricing.amountToPay || 0),
      dueAmount: Number(pricing.dueAmount || 0),
      remainingAmount: Number(pricing.dueAmount || 0),
      status: "confirmed",
      paymentStatus: Number(pricing.dueAmount || 0) > 0 ? "advance_paid" : "paid",
      razorpayOrderId,
      razorpayPaymentId,
      paidAt: now,
      paymentMethod: "online",
      whatsappStatus: "pending",
      whatsappSentAt: null,
      invoiceNumber,
      cancelledAt: null,
      refundAmount: 0,
      refundStatus: "none",
      createdAt: now,
      updatedAt: now,
    }, { merge: true })

    transaction.set(paymentRef, {
      bookingId: bookingRef.id,
      userId,
      listingId: intent.listingId,
      branchId: intent.branchId,
      invoiceNumber,
      amount: Number(pricing.amountToPay || 0),
      currency: "INR",
      status: "captured",
      gateway: "razorpay",
      method: "razorpay",
      razorpayOrderId,
      razorpayPaymentId,
      createdAt: now,
      updatedAt: now,
    })

    if (intent.couponId) {
      const couponRef = adminDb.collection("coupons").doc(intent.couponId)
      const couponSnap = await transaction.get(couponRef)
      if (couponSnap.exists) {
        const couponData = couponSnap.data()
        transaction.update(couponRef, { usedCount: Number(couponData?.usedCount || 0) + 1 })
      }
    }

    transaction.update(intentRef, {
      status: "consumed",
      bookingId: bookingRef.id,
      finalizedAt: now,
      updatedAt: now,
    })

    return {
      bookingId: bookingRef.id,
      invoiceNumber,
      totalAmount: Number(pricing.totalAmount || 0),
      advancePaid: Number(pricing.amountToPay || 0),
    }
  })
  return result
}
