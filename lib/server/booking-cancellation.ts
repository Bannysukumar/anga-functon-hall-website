import { Timestamp } from "firebase-admin/firestore"
import { adminDb } from "@/lib/server/firebase-admin"

export async function releaseBookingAvailability(bookingId: string, unitsBooked = 1) {
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
    batch.set(
      lockDoc.ref,
      {
        bookingIds: nextIds,
        bookedUnits: nextBookedUnits,
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

