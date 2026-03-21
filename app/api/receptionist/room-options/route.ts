import { NextResponse } from "next/server"
import { adminDb } from "@/lib/server/firebase-admin"
import { requirePermission, toHttpError } from "@/lib/server/permission-check"
import {
  filterRoomsByTypeAndFloor,
  parseRoomConfigurations,
  roomIntervalsOverlap,
} from "@/lib/server/receptionist-room-availability"

export async function GET(request: Request) {
  try {
    await requirePermission(request, "view_bookings")
    const url = new URL(request.url)
    const listingId = String(url.searchParams.get("listingId") || "").trim()
    const checkIn = String(url.searchParams.get("checkIn") || "").trim()
    const checkOut = String(url.searchParams.get("checkOut") || "").trim()
    const roomType = url.searchParams.get("roomType") as "ac" | "non_ac" | null
    const floorRaw = url.searchParams.get("floor")
    const floor =
      floorRaw != null && floorRaw !== "" && !Number.isNaN(Number(floorRaw))
        ? Number(floorRaw)
        : null

    if (!listingId) {
      return NextResponse.json({ error: "listingId is required." }, { status: 400 })
    }

    const listingSnap = await adminDb.collection("listings").doc(listingId).get()
    if (!listingSnap.exists) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 })
    }
    const listing = { id: listingSnap.id, ...(listingSnap.data() || {}) } as Record<
      string,
      unknown
    >
    const listingType = String(listing.type || "")
    if (listingType !== "room") {
      return NextResponse.json({
        listingType,
        rooms: [],
        message: "Room filters apply only to room listings.",
      })
    }

    let configs = parseRoomConfigurations(listing)
    if (configs.length === 0) {
      const rn = String(listing.roomNumber || "").trim()
      if (rn) {
        configs = [
          {
            roomNumber: rn,
            roomType: String(listing.roomTypeDetail || "ac") === "non_ac" ? "non_ac" : "ac",
            floorNumber: Number(listing.floorNumber) || undefined,
          },
        ]
      }
    }

    const filtered = filterRoomsByTypeAndFloor(
      configs,
      roomType === "ac" || roomType === "non_ac" ? roomType : null,
      floor
    )

    const checkInDate = checkIn ? new Date(checkIn) : null
    const checkOutDate = checkOut ? new Date(checkOut) : null
    const hasWindow =
      checkInDate &&
      checkOutDate &&
      !Number.isNaN(checkInDate.getTime()) &&
      !Number.isNaN(checkOutDate.getTime()) &&
      checkOutDate.getTime() > checkInDate.getTime()

    let bookings: Array<Record<string, unknown>> = []
    if (hasWindow) {
      const snap = await adminDb.collection("bookings").where("listingId", "==", listingId).limit(500).get()
      bookings = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    }

    const rooms = filtered.map((cfg) => {
      const available =
        hasWindow && checkInDate && checkOutDate
          ? !roomIntervalsOverlap(
              checkInDate,
              checkOutDate,
              bookings,
              cfg.roomNumber,
              listingId
            )
          : true
      return {
        roomNumber: cfg.roomNumber,
        roomType: cfg.roomType,
        floorNumber: cfg.floorNumber ?? null,
        available,
      }
    })

    return NextResponse.json({ listingId, listingType, rooms })
  } catch (error) {
    const mapped = toHttpError(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}
