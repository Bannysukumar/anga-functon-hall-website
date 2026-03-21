import { NextResponse } from "next/server"
import { ZodError } from "zod"
import { Timestamp } from "firebase-admin/firestore"
import { adminDb } from "@/lib/server/firebase-admin"
import { requirePermission, toHttpError } from "@/lib/server/permission-check"
import {
  createBookingSchema,
  receptionistBookingsQuerySchema,
} from "@/lib/server/receptionist-schemas"
import { getRequestMeta, sanitizeText } from "@/lib/server/request-meta"
import { buildBookingConfirmationMessage, sendWhatsAppMessage } from "@/lib/server/whatsapp"
import {
  filterRoomsByTypeAndFloor,
  parseRoomConfigurations,
  roomIntervalsOverlap,
} from "@/lib/server/receptionist-room-availability"

function toInvoiceNumber(counter: number) {
  const year = new Date().getFullYear()
  return `INV-${year}-${String(counter).padStart(6, "0")}`
}

function normalizeDateKey(functionDateTime: string) {
  const trimmed = String(functionDateTime || "").trim()
  const direct = trimmed.match(/^(\d{4}-\d{2}-\d{2})/)
  if (direct?.[1]) return direct[1]
  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear()
    const month = String(parsed.getMonth() + 1).padStart(2, "0")
    const day = String(parsed.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }
  return ""
}

function toMinutes(hhmm: string) {
  const [h, m] = String(hhmm || "")
    .split(":")
    .map((value) => Number(value))
  if (!Number.isFinite(h) || !Number.isFinite(m)) return -1
  return h * 60 + m
}

function resolveBookingSlot(
  listing: Record<string, unknown>,
  functionDateTime: string
): { slotId: string | null; slotName: string | null } {
  const slotsEnabled = Boolean(listing.slotsEnabled)
  const slots = Array.isArray(listing.slots) ? listing.slots : []
  if (!slotsEnabled || slots.length === 0) {
    return { slotId: null, slotName: null }
  }

  const timeMatch = String(functionDateTime || "").match(/T(\d{2}):(\d{2})/)
  const inputMinutes = timeMatch ? Number(timeMatch[1]) * 60 + Number(timeMatch[2]) : -1

  if (inputMinutes >= 0) {
    const matched = slots.find((entry) => {
      const item = entry as Record<string, unknown>
      const start = toMinutes(String(item.startTime || ""))
      const end = toMinutes(String(item.endTime || ""))
      if (start < 0 || end < 0) return false
      if (end >= start) {
        return inputMinutes >= start && inputMinutes <= end
      }
      // Handle overnight slots
      return inputMinutes >= start || inputMinutes <= end
    }) as Record<string, unknown> | undefined
    if (matched) {
      return {
        slotId: String(matched.slotId || "") || null,
        slotName: String(matched.name || "") || null,
      }
    }
  }

  const first = slots[0] as Record<string, unknown>
  return {
    slotId: String(first.slotId || "") || null,
    slotName: String(first.name || "") || null,
  }
}

function isSingleBookingListing(listingType: string) {
  return ["function_hall", "open_function_hall", "dining_hall"].includes(String(listingType || ""))
}

/** Serialize Firestore Timestamps to ISO strings so the client can always parse dates reliably. */
function timestampToIso(value: unknown): string | null {
  if (value == null) return null
  if (value instanceof Timestamp) {
    const d = value.toDate()
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    try {
      const d = (value as { toDate: () => Date }).toDate()
      return Number.isNaN(d.getTime()) ? null : d.toISOString()
    } catch {
      return null
    }
  }
  return null
}

const BOOKING_TS_FIELDS = [
  "checkInDate",
  "checkOutDate",
  "scheduledCheckInAt",
  "scheduledCheckOutAt",
  "checkInAt",
  "checkOutAt",
  "cancelledAt",
  "createdAt",
  "updatedAt",
  "paidAt",
] as const

function serializeBookingForClient(booking: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...booking }
  for (const k of BOOKING_TS_FIELDS) {
    if (k in out && out[k] != null) {
      out[k] = timestampToIso(out[k])
    }
  }
  return out
}

export async function GET(request: Request) {
  try {
    await requirePermission(request, "view_bookings")
    const url = new URL(request.url)
    const query = receptionistBookingsQuerySchema.parse({
      search: url.searchParams.get("search") || "",
      status: url.searchParams.get("status") || "all",
      from: url.searchParams.get("from") || "",
      to: url.searchParams.get("to") || "",
      page: url.searchParams.get("page") || 1,
      limit: url.searchParams.get("limit") || 20,
    })
    const search = query.search.toLowerCase()
    const status = query.status
    const from = query.from
    const to = query.to
    const page = query.page
    const limit = query.limit

    const snap = await adminDb.collection("bookings").orderBy("createdAt", "desc").limit(500).get()
    let items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

    if (status && status !== "all") {
      items = items.filter((booking) => String(booking.status || "") === status)
    }
    if (search) {
      items = items.filter((booking) => {
        const listingTitle = String(booking.listingTitle || "").toLowerCase()
        const invoice = String(booking.invoiceNumber || "").toLowerCase()
        const branch = String(booking.branchName || "").toLowerCase()
        const customerName = String(booking.customerName || "").toLowerCase()
        const customerPhone = String(booking.customerPhone || "").toLowerCase()
        const customerEmail = String(booking.customerEmail || "").toLowerCase()
        const id = String(booking.id || "").toLowerCase()
        return (
          listingTitle.includes(search) ||
          invoice.includes(search) ||
          branch.includes(search) ||
          customerName.includes(search) ||
          customerPhone.includes(search) ||
          customerEmail.includes(search) ||
          id.includes(search)
        )
      })
    }
    if (from || to) {
      items = items.filter((booking) => {
        const dt = booking.checkInDate?.toDate ? booking.checkInDate.toDate() : null
        if (!dt) return false
        if (from && dt < new Date(`${from}T00:00:00`)) return false
        if (to && dt > new Date(`${to}T23:59:59`)) return false
        return true
      })
    }

    const total = items.length
    const start = (page - 1) * limit
    const end = start + limit
    const pageItems = items
      .slice(start, end)
      .map((b) => serializeBookingForClient(b as Record<string, unknown>))
    return NextResponse.json({
      items: pageItems,
      total,
      page,
      limit,
      hasMore: end < total,
    })
  } catch (error) {
    if ((error as { name?: string })?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid booking query." }, { status: 422 })
    }
    const mapped = toHttpError(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}

export async function POST(request: Request) {
  try {
    const { uid } = await requirePermission(request, "create_booking")
    const meta = getRequestMeta(request)
    const body = createBookingSchema.parse(await request.json())

    const listingId = sanitizeText(body.listingId, 120)
    const functionDateTime = sanitizeText(body.functionDateTime, 200)
    const paymentMethod = sanitizeText(body.paymentMethod || "cash", 40)
    const notes = sanitizeText(body.notes || "", 500)
    const singleRoom = sanitizeText(String(body.selectedRoomNumber || ""), 60)
    const requestedRoomNumbers = singleRoom
      ? [singleRoom]
      : Array.isArray(body.selectedRoomNumbers)
        ? body.selectedRoomNumbers.map((value) => sanitizeText(String(value), 60)).filter(Boolean)
        : []
    const guestCount = Math.max(1, Number(body.guestCount))
    const advanceAmount = Math.max(0, Number(body.advanceAmount))
    const totalAmount = Math.max(0, Number(body.totalAmount))
    const dueAmount = Math.max(0, totalAmount - advanceAmount)

    if (!listingId || !functionDateTime || totalAmount <= 0) {
      return NextResponse.json(
        { error: "listingId, functionDateTime and totalAmount are required." },
        { status: 400 }
      )
    }

    const listingRef = adminDb.collection("listings").doc(listingId)
    const counterRef = adminDb.collection("counters").doc("invoices")
    const bookingRef = adminDb.collection("bookings").doc()
    const paymentRef = adminDb.collection("payments").doc()
    const customerId = sanitizeText(body.customerId || "", 120)
    const customerRef = customerId ? adminDb.collection("customers").doc(customerId) : null
    const customerUserRef = customerId ? adminDb.collection("users").doc(customerId) : null

    const settingsSnap = await adminDb.collection("settings").doc("global").get()
    const globalSettings = (settingsSnap.data() || {}) as Record<string, unknown>

    const listingPreviewSnap = await listingRef.get()
    if (!listingPreviewSnap.exists) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 })
    }
    const listingPreview = listingPreviewSnap.data() || {}
    const listingTypePreview = String(listingPreview.type || "function_hall")

    const checkInDate = new Date(functionDateTime)
    if (Number.isNaN(checkInDate.getTime())) {
      return NextResponse.json({ error: "Invalid check-in date/time." }, { status: 400 })
    }
    const nowMs = Date.now()
    if (checkInDate.getTime() < nowMs - 60_000) {
      return NextResponse.json({ error: "Cannot create bookings in the past." }, { status: 400 })
    }

    const checkOutRaw = String(body.checkOutDateTime || "").trim()
    const defOutTime = String(
      listingPreview.defaultCheckOutTime ?? globalSettings.defaultCheckOutTime ?? "11:00"
    ).trim() || "11:00"
    let checkOutDate: Date
    if (checkOutRaw) {
      checkOutDate = new Date(checkOutRaw)
    } else {
      const checkInDateKey = normalizeDateKey(functionDateTime)
      if (!checkInDateKey) {
        return NextResponse.json({ error: "Invalid check-in date." }, { status: 400 })
      }
      checkOutDate = new Date(`${checkInDateKey}T${defOutTime}`)
      if (checkOutDate.getTime() <= checkInDate.getTime()) {
        checkOutDate = new Date(checkOutDate.getTime() + 24 * 60 * 60 * 1000)
      }
    }
    if (Number.isNaN(checkOutDate.getTime()) || checkOutDate.getTime() <= checkInDate.getTime()) {
      return NextResponse.json(
        { error: "Check-out must be after check-in." },
        { status: 400 }
      )
    }

    const existingOverlapSnap = await adminDb
      .collection("bookings")
      .where("listingId", "==", listingId)
      .limit(500)
      .get()
    const existingBookingsOverlap = existingOverlapSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Array<Record<string, unknown>>

    let resolvedSelectedRoomNumbers = requestedRoomNumbers
    let resolvedRoomTypeDetail: "ac" | "non_ac" = "ac"
    let resolvedFloorLabel = ""

    if (listingTypePreview === "room") {
      const configs = parseRoomConfigurations(listingPreview as Record<string, unknown>)
      let roomsToBook =
        requestedRoomNumbers.length > 0
          ? requestedRoomNumbers
          : String(listingPreview.roomNumber || "").trim()
            ? [String(listingPreview.roomNumber || "").trim()]
            : []
      if (configs.length > 0) {
        let filtered = configs
        if (body.roomType) {
          filtered = filtered.filter((c) => c.roomType === body.roomType)
        }
        if (body.floor != null && !Number.isNaN(Number(body.floor))) {
          filtered = filtered.filter((c) => c.floorNumber === Number(body.floor))
        }
        const allowed = new Set(filtered.map((r) => r.roomNumber))
        roomsToBook = roomsToBook.filter((n) => allowed.has(n))
      }
      if (configs.length > 0 && roomsToBook.length === 0) {
        return NextResponse.json(
          { error: "Select room type, floor, and a room number that matches your filters." },
          { status: 400 }
        )
      }
      resolvedSelectedRoomNumbers = roomsToBook
      for (const num of roomsToBook) {
        if (
          roomIntervalsOverlap(checkInDate, checkOutDate, existingBookingsOverlap, num, listingId)
        ) {
          return NextResponse.json(
            { error: "Room already booked for the selected time range." },
            { status: 409 }
          )
        }
        const cfg = configs.find((c) => c.roomNumber === num)
        if (cfg) {
          resolvedRoomTypeDetail = cfg.roomType
          resolvedFloorLabel =
            cfg.floorNumber != null ? `Floor ${cfg.floorNumber}` : resolvedFloorLabel
        } else if (String(listingPreview.roomNumber || "").trim() === num) {
          resolvedRoomTypeDetail =
            String(listingPreview.roomTypeDetail || "ac") === "non_ac" ? "non_ac" : "ac"
          const fn = Number(listingPreview.floorNumber)
          if (Number.isFinite(fn)) resolvedFloorLabel = `Floor ${fn}`
        }
      }
    }

    if (listingTypePreview === "room" && resolvedSelectedRoomNumbers.length === 0) {
      return NextResponse.json(
        { error: "Room number is required for room bookings." },
        { status: 400 }
      )
    }

    const result = await adminDb.runTransaction(async (transaction) => {
      const listingSnap = await transaction.get(listingRef)
      if (!listingSnap.exists) throw new Error("LISTING_NOT_FOUND")
      const listing = listingSnap.data() || {}
      const branchId = String(listing.branchId || "")
      const branchSnap = branchId
        ? await transaction.get(adminDb.collection("branches").doc(branchId))
        : null
      const customerSnap = customerRef ? await transaction.get(customerRef) : null
      const customerUserSnap =
        customerId && (!customerSnap || !customerSnap.exists) && customerUserRef
          ? await transaction.get(customerUserRef)
          : null
      const counterSnap = await transaction.get(counterRef)
      const nextCounter = Number(counterSnap.data()?.value || 0) + 1
      const invoiceNumber = toInvoiceNumber(nextCounter)
      const checkInTs = Timestamp.fromDate(checkInDate)
      const checkOutTs = Timestamp.fromDate(checkOutDate)
      const checkInDateKey = normalizeDateKey(functionDateTime)
      if (!checkInDateKey) throw new Error("INVALID_DATE")
      const scheduledCheckInAt = Timestamp.fromDate(checkInDate)
      const scheduledCheckOutAt = Timestamp.fromDate(checkOutDate)
      const bookingSlot = resolveBookingSlot(listing, functionDateTime)
      const listingType = String(listing.type || "function_hall")
      const selectedRoomNumbers = listingType === "room"
        ? resolvedSelectedRoomNumbers.length > 0
          ? resolvedSelectedRoomNumbers
          : String(listing.roomNumber || "").trim()
            ? [String(listing.roomNumber || "").trim()]
            : []
        : []
      if (isSingleBookingListing(listingType)) {
        const existingSnap = await adminDb
          .collection("bookings")
          .where("listingId", "==", listingId)
          .limit(300)
          .get()
        const hasConflict = existingSnap.docs.some((doc) => {
          const existing = doc.data() || {}
          const existingStatus = String(existing.status || "")
          if (["cancelled", "completed", "checked_out", "no_show"].includes(existingStatus)) {
            return false
          }
          const existingDate = existing.checkInDate?.toDate?.() as Date | undefined
          const dateKey = existingDate ? normalizeDateKey(existingDate.toISOString()) : ""
          return dateKey === checkInDateKey
        })
        if (hasConflict) {
          throw new Error("HALL_ALREADY_BOOKED")
        }
      }
      const usesRoomResource =
        String(listing.roomId || "").trim() &&
        !["function_hall", "open_function_hall", "dining_hall", "local_tour"].includes(listingType)
      const availabilityResourceId = usesRoomResource
        ? String(listing.roomId || "").trim().toUpperCase()
        : listingId
      const availabilitySlotId = bookingSlot.slotId || "default"
      const availabilityLockRef = adminDb
        .collection("availabilityLocks")
        .doc(`${availabilityResourceId}_${checkInDateKey}_${availabilitySlotId}`)
      const availabilityLockSnap = await transaction.get(availabilityLockRef)
      const unitsNeeded = 1
      const maxUnits = Math.max(1, Number(listing.inventory || 1))
      const currentBookedUnits = availabilityLockSnap.exists
        ? Number(availabilityLockSnap.data()?.bookedUnits || 0)
        : 0
      if (availabilityLockSnap.exists && availabilityLockSnap.data()?.isBlocked) {
        throw new Error("DATE_BLOCKED")
      }
      const alreadyBookedRoomNumbers = new Set(
        Array.isArray(availabilityLockSnap.data()?.selectedRoomNumbers)
          ? (availabilityLockSnap.data()?.selectedRoomNumbers as unknown[]).map((value) =>
              String(value).trim()
            )
          : []
      )
      if (selectedRoomNumbers.some((room) => alreadyBookedRoomNumbers.has(room))) {
        throw new Error("ROOM_ALREADY_BOOKED")
      }
      if (currentBookedUnits + unitsNeeded > maxUnits) {
        throw new Error("DATE_FULL")
      }

      const resolvedCustomerName =
        customerSnap?.exists
          ? String(customerSnap.data()?.name || "")
          : customerUserSnap?.exists
            ? String(customerUserSnap.data()?.displayName || customerUserSnap.data()?.name || "")
            : ""
      const resolvedCustomerPhone =
        customerSnap?.exists
          ? String(customerSnap.data()?.phone || "")
          : customerUserSnap?.exists
            ? String(customerUserSnap.data()?.phone || "")
            : ""
      const resolvedCustomerEmail =
        customerSnap?.exists
          ? String(customerSnap.data()?.email || "")
          : customerUserSnap?.exists
            ? String(customerUserSnap.data()?.email || "")
            : ""

      transaction.set(counterRef, { value: nextCounter }, { merge: true })
      if (availabilityLockSnap.exists) {
        const previousRoomNumbers = Array.isArray(availabilityLockSnap.data()?.selectedRoomNumbers)
          ? (availabilityLockSnap.data()?.selectedRoomNumbers as unknown[]).map((value) =>
              String(value).trim()
            )
          : []
        transaction.set(
          availabilityLockRef,
          {
            bookedUnits: currentBookedUnits + unitsNeeded,
            selectedRoomNumbers: Array.from(new Set([...previousRoomNumbers, ...selectedRoomNumbers])),
            bookingIds: [...((availabilityLockSnap.data()?.bookingIds as string[] | undefined) || []), bookingRef.id],
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        )
      } else {
        transaction.set(availabilityLockRef, {
          listingId: availabilityResourceId,
          date: checkInDateKey,
          slotId: availabilitySlotId,
          bookedUnits: unitsNeeded,
          maxUnits,
          selectedRoomNumbers,
          bookingIds: [bookingRef.id],
          isBlocked: false,
          updatedAt: Timestamp.now(),
        })
      }

      const remainingAmount = Math.max(0, totalAmount - advanceAmount)
      const normalizedPaymentStatus = remainingAmount > 0 ? "partial" : "paid"
      transaction.set(bookingRef, {
        userId: customerId || uid,
        customerId: customerId || null,
        customerName: resolvedCustomerName,
        customerPhone: resolvedCustomerPhone,
        customerEmail: resolvedCustomerEmail,
        listingId,
        roomId: String(listing.roomId || ""),
        roomNumber:
          selectedRoomNumbers[0] ||
          String(listing.roomNumber || ""),
        roomTypeDetail:
          listingType === "room"
            ? resolvedRoomTypeDetail
            : String(listing.roomTypeDetail || "ac") === "non_ac"
              ? "non_ac"
              : "ac",
        roomFloorLabel: resolvedFloorLabel || null,
        selectedRoomListingIds: selectedRoomNumbers.length > 0 ? [listingId] : [],
        selectedRoomNumbers,
        branchId,
        listingType,
        listingTitle: String(listing.title || "Listing"),
        branchName: branchSnap?.exists ? String(branchSnap.data()?.name || "") : "",
        checkInDate: checkInTs,
        checkOutDate: checkOutTs,
        scheduledCheckInAt,
        scheduledCheckOutAt,
        slotId: bookingSlot.slotId,
        slotName: bookingSlot.slotName,
        guestCount,
        unitsBooked: 1,
        selectedAddons: [],
        basePrice: totalAmount,
        addonsTotal: 0,
        couponDiscount: 0,
        taxAmount: 0,
        serviceFee: 0,
        totalAmount,
        advancePaid: advanceAmount,
        dueAmount,
        remainingAmount,
        status: "confirmed",
        paymentStatus: normalizedPaymentStatus,
        razorpayOrderId: "",
        razorpayPaymentId: "",
        whatsappStatus: "pending",
        whatsappSentAt: null,
        invoiceNumber,
        invoiceId: null,
        createdByRole: "receptionist",
        bookingNotes: notes,
        cancelledAt: null,
        refundAmount: 0,
        refundStatus: "none",
        paymentMethod: paymentMethod === "online" ? "online" : "cash",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })

      transaction.set(paymentRef, {
        bookingId: bookingRef.id,
        userId: customerId || uid,
        listingId,
        branchId,
        invoiceNumber,
        amount: advanceAmount,
        totalAmount,
        currency: "INR",
        status: "captured",
        gateway: "manual_reception",
        method: paymentMethod,
        razorpayOrderId: "",
        razorpayPaymentId: "",
        note: notes,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })

      transaction.set(adminDb.collection("auditLogs").doc(), {
        entity: "booking",
        entityId: bookingRef.id,
        action: "CREATE",
        message: "Receptionist created booking",
        payload: {
          listingId,
          customerId: customerId || null,
          invoiceNumber,
          totalAmount,
          advanceAmount,
          paymentMethod,
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        createdBy: uid,
        createdAt: Timestamp.now(),
      })

      return {
        bookingId: bookingRef.id,
        paymentId: paymentRef.id,
        invoiceNumber,
        customerName: resolvedCustomerName,
        customerPhone: resolvedCustomerPhone,
        customerEmail: resolvedCustomerEmail,
        listingTitle: String(listing.title || "Listing"),
        totalAmount,
        status: "confirmed",
        checkInDate: checkInTs,
      }
    })

    if (result.customerPhone) {
      const eventDate = functionDateTime
      const waMessage = buildBookingConfirmationMessage({
        customerName: result.customerName || "Customer",
        eventDate,
        hallName: result.listingTitle || "Anga Function Hall",
      })
      const waResult = await sendWhatsAppMessage(String(result.customerPhone), waMessage)
      await adminDb.collection("bookings").doc(result.bookingId).set(
        {
          whatsappStatus: waResult.status,
          whatsappSentAt: waResult.status === "sent" ? Timestamp.now() : null,
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      )
    }
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid booking payload.", issues: error.flatten() },
        { status: 422 }
      )
    }
    const errMessage = error instanceof Error ? error.message : "Unexpected server error"
    if (errMessage === "LISTING_NOT_FOUND") {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 })
    }
    if (errMessage === "INVALID_DATE") {
      return NextResponse.json({ error: "Invalid function date/time." }, { status: 400 })
    }
    if (errMessage === "DATE_BLOCKED") {
      return NextResponse.json({ error: "Selected date/slot is blocked." }, { status: 409 })
    }
    if (errMessage === "DATE_FULL") {
      return NextResponse.json({ error: "Selected date/slot is fully booked." }, { status: 409 })
    }
    if (errMessage === "HALL_ALREADY_BOOKED") {
      return NextResponse.json(
        { error: "This hall is already booked for the selected date." },
        { status: 409 }
      )
    }
    if (errMessage === "ROOM_ALREADY_BOOKED") {
      return NextResponse.json(
        { error: "Selected room is already booked for the selected date." },
        { status: 409 }
      )
    }
    const mapped = toHttpError(error)
    if (mapped.status !== 500) {
      return NextResponse.json({ error: mapped.error }, { status: mapped.status })
    }
    return NextResponse.json({ error: errMessage }, { status: 500 })
  }
}
