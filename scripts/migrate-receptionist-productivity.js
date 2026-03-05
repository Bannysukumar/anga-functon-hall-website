/* eslint-disable no-console */
const admin = require("firebase-admin")

function initAdmin() {
  if (admin.apps.length > 0) return
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    })
    return
  }
  admin.initializeApp()
}

async function run() {
  initAdmin()
  const db = admin.firestore()
  console.log("Starting receptionist productivity migration...")

  const settingsRef = db.collection("settings").doc("global")
  await settingsRef.set({ paymentRemindersEnabled: true }, { merge: true })
  console.log("Updated settings.global.paymentRemindersEnabled")

  const bookingsSnap = await db.collection("bookings").limit(2000).get()
  const batch = db.batch()
  bookingsSnap.docs.forEach((doc) => {
    const data = doc.data() || {}
    const totalAmount = Number(data.totalAmount || 0)
    const advancePaid = Number(data.advancePaid || 0)
    const remainingAmount = Math.max(0, Number(data.remainingAmount ?? data.dueAmount ?? totalAmount - advancePaid))
    const paymentStatus =
      remainingAmount <= 0
        ? "paid"
        : advancePaid > 0
          ? "partial"
          : "pending"
    batch.set(
      doc.ref,
      {
        remainingAmount,
        paymentStatus,
        whatsappStatus: data.whatsappStatus || "pending",
        whatsappSentAt: data.whatsappSentAt || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
  })
  await batch.commit()
  console.log(`Backfilled ${bookingsSnap.size} bookings.`)

  console.log("Migration completed.")
}

run().catch((error) => {
  console.error("Migration failed:", error)
  process.exit(1)
})
