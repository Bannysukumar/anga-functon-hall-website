import { NextResponse } from "next/server"
import { Timestamp } from "firebase-admin/firestore"
import { adminDb } from "@/lib/server/firebase-admin"
import { requirePermission, toHttpError } from "@/lib/server/permission-check"
import { convertVisitorSchema, updateVisitorSchema } from "@/lib/server/receptionist-schemas"
import { sanitizeText } from "@/lib/server/request-meta"
import { bookingDateKeyFromInput } from "@/lib/server/booking-time"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { uid } = await requirePermission(request, "manage_visitors")
    const { id } = await params
    const body = updateVisitorSchema.parse(await request.json())
    const updates: Record<string, unknown> = { updatedAt: Timestamp.now(), updatedBy: uid }
    if (body.name !== undefined) updates.name = sanitizeText(body.name, 120)
    if (body.phone !== undefined) updates.phone = sanitizeText(body.phone, 20)
    if (body.eventType !== undefined) updates.eventType = sanitizeText(body.eventType, 60)
    if (body.preferredDate !== undefined) updates.preferredDate = sanitizeText(body.preferredDate, 25)
    if (body.notes !== undefined) updates.notes = sanitizeText(body.notes || "", 500)
    if (body.status !== undefined) updates.status = body.status
    await adminDb.collection("visitors").doc(id).set(updates, { merge: true })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if ((error as { name?: string })?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid visitor payload." }, { status: 422 })
    }
    const mapped = toHttpError(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { uid } = await requirePermission(request, "manage_visitors")
    const { id } = await params
    const body = convertVisitorSchema.parse(await request.json())
    const visitorRef = adminDb.collection("visitors").doc(id)
    const visitorSnap = await visitorRef.get()
    if (!visitorSnap.exists) {
      return NextResponse.json({ error: "Visitor lead not found." }, { status: 404 })
    }
    const visitor = visitorSnap.data() || {}

    const bookingRef = adminDb.collection("bookings").doc()
    const listingRef = adminDb.collection("listings").doc(String(body.listingId))
    const listingSnap = await listingRef.get()
    if (!listingSnap.exists) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 })
    }
    const listing = listingSnap.data() || {}
    const branchId = String(listing.branchId || "")
    const branchSnap = branchId ? await adminDb.collection("branches").doc(branchId).get() : null

    const eventDateKey = bookingDateKeyFromInput(body.functionDateTime)
    if (!eventDateKey) {
      return NextResponse.json({ error: "Invalid function date/time." }, { status: 400 })
    }
    const listingType = String(listing.type || "function_hall")
    const usesRoomResource =
      String(listing.roomId || "").trim() &&
      !["function_hall", "open_function_hall", "dining_hall", "local_tour"].includes(listingType)
    const availabilityResourceId = usesRoomResource
      ? String(listing.roomId || "").trim().toUpperCase()
      : String(body.listingId)
    const lockRef = adminDb.collection("availabilityLocks").doc(`${availabilityResourceId}_${eventDateKey}_default`)

    await adminDb.runTransaction(async (tx) => {
      const lockSnap = await tx.get(lockRef)
      const maxUnits = Math.max(1, Number(listing.inventory || 1))
      const booked = lockSnap.exists ? Number(lockSnap.data()?.bookedUnits || 0) : 0
      if (lockSnap.exists && lockSnap.data()?.isBlocked) throw new Error("DATE_BLOCKED")
      if (booked + 1 > maxUnits) throw new Error("DATE_FULL")

      if (lockSnap.exists) {
        tx.set(
          lockRef,
          {
            bookedUnits: booked + 1,
            bookingIds: [...((lockSnap.data()?.bookingIds as string[] | undefined) || []), bookingRef.id],
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        )
      } else {
        tx.set(lockRef, {
          listingId: availabilityResourceId,
          date: eventDateKey,
          slotId: "default",
          bookedUnits: 1,
          maxUnits,
          bookingIds: [bookingRef.id],
          isBlocked: false,
          updatedAt: Timestamp.now(),
        })
      }

      tx.set(bookingRef, {
        userId: uid,
        customerId: null,
        customerName: String(visitor.name || "Walk-in Visitor"),
        customerPhone: String(visitor.phone || ""),
        listingId: body.listingId,
        branchId,
        listingType,
        listingTitle: String(listing.title || "Listing"),
        branchName: branchSnap?.exists ? String(branchSnap.data()?.name || "") : "",
        checkInDate: Timestamp.fromDate(new Date(body.functionDateTime)),
        checkOutDate: null,
        slotId: null,
        slotName: null,
        guestCount: Math.max(1, Number(body.guestCount || 1)),
        unitsBooked: 1,
        selectedAddons: [],
        basePrice: Number(body.totalAmount || 0),
        addonsTotal: 0,
        couponDiscount: 0,
        taxAmount: 0,
        serviceFee: 0,
        totalAmount: Number(body.totalAmount || 0),
        advancePaid: Number(body.advanceAmount || 0),
        dueAmount: Math.max(0, Number(body.totalAmount || 0) - Number(body.advanceAmount || 0)),
        remainingAmount: Math.max(0, Number(body.totalAmount || 0) - Number(body.advanceAmount || 0)),
        status: "confirmed",
        paymentStatus:
          Math.max(0, Number(body.totalAmount || 0) - Number(body.advanceAmount || 0)) > 0
            ? "partial"
            : "paid",
        razorpayOrderId: "",
        razorpayPaymentId: "",
        invoiceNumber: `WALKIN-${Date.now()}`,
        invoiceId: null,
        createdByRole: "receptionist",
        bookingNotes: sanitizeText(body.notes || "", 500),
        cancelledAt: null,
        refundAmount: 0,
        refundStatus: "none",
        whatsappStatus: "pending",
        whatsappSentAt: null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
    })

    await visitorRef.set(
      {
        status: "converted",
        convertedBookingId: bookingRef.id,
        updatedAt: Timestamp.now(),
        updatedBy: uid,
      },
      { merge: true }
    )
    return NextResponse.json({ ok: true, bookingId: bookingRef.id })
  } catch (error) {
    if (error instanceof Error && error.message === "DATE_BLOCKED") {
      return NextResponse.json({ error: "Selected date is blocked." }, { status: 409 })
    }
    if (error instanceof Error && error.message === "DATE_FULL") {
      return NextResponse.json({ error: "Selected date is fully booked." }, { status: 409 })
    }
    if ((error as { name?: string })?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid conversion payload." }, { status: 422 })
    }
    const mapped = toHttpError(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}
