/* eslint-disable no-console */
const admin = require("firebase-admin")

const DEFAULT_RECEPTIONIST_PERMISSIONS = [
  "view_dashboard",
  "view_bookings",
  "create_booking",
  "edit_booking",
  "cancel_booking",
  "view_customers",
  "create_customer",
  "edit_customer",
  "view_payments",
  "create_payment_receipt",
  "view_rooms",
  "check_in",
  "check_out",
  "view_reports",
  "export_reports",
  "view_calendar",
  "manage_visitors",
  "send_whatsapp",
  "manage_payment_reminders",
]

async function run() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    })
  }
  const db = admin.firestore()

  const rolesRef = db.collection("roles")
  const receptionistRoleQuery = await rolesRef
    .where("roleName", "==", "receptionist")
    .limit(1)
    .get()

  if (receptionistRoleQuery.empty) {
    await rolesRef.add({
      roleName: "receptionist",
      description: "Front desk receptionist role",
      permissions: DEFAULT_RECEPTIONIST_PERMISSIONS,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    console.log("Created receptionist role")
  } else {
    const doc = receptionistRoleQuery.docs[0]
    await doc.ref.set(
      {
        permissions: DEFAULT_RECEPTIONIST_PERMISSIONS,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    console.log("Updated receptionist role permissions")
  }

  await db
    .collection("settings")
    .doc("global")
    .set(
      {
        receptionistPermissions: DEFAULT_RECEPTIONIST_PERMISSIONS,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
  console.log("Seeded settings.global.receptionistPermissions")
}

run()
  .then(() => {
    console.log("RBAC seed complete")
    process.exit(0)
  })
  .catch((error) => {
    console.error("RBAC seed failed:", error)
    process.exit(1)
  })
