/* eslint-disable no-console */
const fs = require("fs")
const path = require("path")
const admin = require("firebase-admin")

function normalizeRoomId(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
}

function isSlotBased(listingType) {
  return ["function_hall", "open_function_hall", "dining_hall", "local_tour"].includes(
    String(listingType || "")
  )
}

function toDateString(value) {
  if (!value) return ""
  if (typeof value.toDate === "function") {
    return value.toDate().toISOString().slice(0, 10)
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }
  const stringValue = String(value)
  if (stringValue.includes("T")) {
    return new Date(stringValue).toISOString().slice(0, 10)
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) return stringValue
  return ""
}

function resolveServiceAccountPath() {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv

  const fallback = path.resolve(
    process.cwd(),
    "anga-functon-hall-e813b-firebase-adminsdk-fbsvc-d69b4fea8d.json"
  )
  if (fs.existsSync(fallback)) return fallback
  return ""
}

async function run() {
  const keyPath = resolveServiceAccountPath()
  if (!keyPath) {
    throw new Error(
      "Service account key not found. Set GOOGLE_APPLICATION_CREDENTIALS or place key in project root."
    )
  }

  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"))
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
  }
  const db = admin.firestore()

  const [listingsSnap, bookingsSnap] = await Promise.all([
    db.collection("listings").get(),
    db.collection("bookings").get(),
  ])

  const listingsById = new Map()
  for (const doc of listingsSnap.docs) {
    listingsById.set(doc.id, { id: doc.id, ...(doc.data() || {}) })
  }

  const activeStatuses = new Set(["confirmed", "checked_in"])
  const aggregates = new Map()
  const bookingRoomUpdates = []
  let skipped = 0

  for (const bookingDoc of bookingsSnap.docs) {
    const booking = bookingDoc.data() || {}
    const status = String(booking.status || "")
    if (!activeStatuses.has(status)) continue

    const listingId = String(booking.listingId || "")
    const listing = listingsById.get(listingId)
    if (!listing) {
      skipped += 1
      continue
    }

    const date = toDateString(booking.checkInDate)
    if (!date) {
      skipped += 1
      continue
    }

    const slotBased = isSlotBased(listing.type)
    const roomId = normalizeRoomId(listing.roomId)
    const resourceId = !slotBased && roomId ? roomId : listingId
    const slotId = slotBased ? String(booking.slotId || "full_day") : "default"
    const units = Math.max(1, Number(booking.unitsBooked || 1))
    const lockId = `${resourceId}_${date}_${slotId}`

    const current = aggregates.get(lockId) || {
      lockId,
      resourceId,
      date,
      slotId,
      bookedUnits: 0,
      maxUnits: 0,
      bookingIds: new Set(),
    }
    current.bookedUnits += units
    current.maxUnits = Math.max(current.maxUnits, Number(listing.inventory || 1))
    current.bookingIds.add(bookingDoc.id)
    aggregates.set(lockId, current)

    if (roomId && String(booking.roomId || "") !== roomId) {
      bookingRoomUpdates.push({ id: bookingDoc.id, roomId })
    }
  }

  const lockEntries = Array.from(aggregates.values())
  console.log(`Preparing ${lockEntries.length} availability lock documents.`)
  console.log(`Preparing ${bookingRoomUpdates.length} booking roomId backfills.`)
  if (skipped > 0) {
    console.log(`Skipped ${skipped} bookings due to missing listing/date.`)
  }

  let batch = db.batch()
  let writes = 0
  const flush = async () => {
    if (writes === 0) return
    await batch.commit()
    batch = db.batch()
    writes = 0
  }

  for (const entry of lockEntries) {
    const lockRef = db.collection("availabilityLocks").doc(entry.lockId)
    const existing = await lockRef.get()
    const existingData = existing.exists ? existing.data() || {} : {}
    batch.set(
      lockRef,
      {
        listingId: entry.resourceId,
        date: entry.date,
        slotId: entry.slotId,
        bookedUnits: entry.bookedUnits,
        maxUnits: Math.max(1, entry.maxUnits),
        bookingIds: Array.from(entry.bookingIds),
        isBlocked: Boolean(existingData.isBlocked || false),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    writes += 1
    if (writes >= 400) await flush()
  }

  for (const update of bookingRoomUpdates) {
    const bookingRef = db.collection("bookings").doc(update.id)
    batch.set(
      bookingRef,
      {
        roomId: update.roomId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    writes += 1
    if (writes >= 400) await flush()
  }

  await flush()
  console.log("Backfill complete.")
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Backfill failed:", error)
    process.exit(1)
  })
