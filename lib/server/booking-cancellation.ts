import { Timestamp } from "firebase-admin/firestore"
import { adminDb } from "@/lib/server/firebase-admin"

export async function releaseBookingAvailability(bookingId: string, unitsBooked = 1) {
  const bookingSnap = await adminDb.collection("bookings").doc(bookingId).get()
  const bookingRoomNumbers = Array.isArray(bookingSnap.data()?.selectedRoomNumbers)
    ? (bookingSnap.data()?.selectedRoomNumbers as unknown[])
        .map((value) => String(value).trim())
        .filter(Boolean)
    : []

  const locksSnap = await adminDb
    .collection("availabilityLocks")
    .where("bookingIds", "array-contains", bookingId)
    .get()

  if (locksSnap.empty) return

  const batch = adminDb.batch()
  for (const lockDoc of locksSnap.docs) {
    const lock = lockDoc.data() || {}
    const currentIds = Array.isArray(lock.bookingIds) ? (lock.bookingIds as string[]) : []
    const nextIds = currentIds.filter((id) => id !== bookingId)
    const currentBookedUnits = Math.max(0, Number(lock.bookedUnits || 0))
    const nextBookedUnits = Math.max(0, currentBookedUnits - Math.max(1, Number(unitsBooked || 1)))
    const nextRoomNumbers = Array.isArray(lock.selectedRoomNumbers)
      ? (lock.selectedRoomNumbers as unknown[])
          .map((value) => String(value).trim())
          .filter((room) => room && !bookingRoomNumbers.includes(room))
      : []
    batch.set(
      lockDoc.ref,
      {
        bookingIds: nextIds,
        bookedUnits: nextBookedUnits,
        selectedRoomNumbers: nextRoomNumbers,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    )
  }

  await batch.commit()
}

export async function markReservationsCancelled(bookingId: string) {
  const reservationsSnap = await adminDb
    .collection("reservations")
    .where("bookingId", "==", bookingId)
    .get()

  if (reservationsSnap.empty) return

  const batch = adminDb.batch()
  for (const reservation of reservationsSnap.docs) {
    batch.set(
      reservation.ref,
      {
        status: "CANCELLED",
        cancelledAt: Timestamp.now(),
      },
      { merge: true }
    )
  }
  await batch.commit()
}

