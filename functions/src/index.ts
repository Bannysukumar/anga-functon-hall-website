import * as admin from "firebase-admin"
import { onCall, HttpsError } from "firebase-functions/v2/https"
import { onDocumentCreated } from "firebase-functions/v2/firestore"
import { onSchedule } from "firebase-functions/v2/scheduler"
import * as logger from "firebase-functions/logger"
import { createHmac, timingSafeEqual } from "node:crypto"
import PDFDocument from "pdfkit"
import nodemailer from "nodemailer"
import Razorpay from "razorpay"

admin.initializeApp()
const db = admin.firestore()

const TIMEZONE = "Asia/Kolkata"

type RuntimeSecureConfig = {
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUser: string
  smtpPass: string
  smtpFromName: string
  smtpFromEmail: string
  adminNotificationEmail: string
  appBaseUrl: string
  razorpayKeyId: string
  razorpaySecretKey: string
}

async function getRuntimeSecureConfig(): Promise<RuntimeSecureConfig> {
  const [smtpSnap, razorpaySnap, settingsSnap] = await Promise.all([
    db.collection("secureSettings").doc("smtp").get(),
    db.collection("secureSettings").doc("razorpay").get(),
    db.collection("settings").doc("global").get(),
  ])
  const smtpData = (smtpSnap.data() || {}) as Record<string, any>
  const razorpayData = (razorpaySnap.data() || {}) as Record<string, any>
  const settingsData = (settingsSnap.data() || {}) as Record<string, any>
  return {
    smtpHost: String(smtpData.smtpHost || process.env.SMTP_HOST || ""),
    smtpPort: Number(smtpData.smtpPort || process.env.SMTP_PORT || 587),
    smtpSecure:
      String(smtpData.smtpSecure ?? process.env.SMTP_SECURE ?? "false").toLowerCase() ===
      "true",
    smtpUser: String(smtpData.smtpUser || process.env.SMTP_USER || ""),
    smtpPass: String(smtpData.smtpPass || process.env.SMTP_PASS || ""),
    smtpFromName: String(smtpData.smtpFromName || process.env.SMTP_FROM_NAME || "Anga Function Hall"),
    smtpFromEmail: String(smtpData.smtpFromEmail || process.env.SMTP_FROM_EMAIL || ""),
    adminNotificationEmail: String(
      smtpData.adminNotificationEmail || process.env.ADMIN_NOTIFICATION_EMAIL || ""
    ),
    appBaseUrl: String(smtpData.appBaseUrl || process.env.APP_BASE_URL || ""),
    razorpayKeyId: String(
      settingsData.razorpayKeyId || process.env.RAZORPAY_KEY_ID || ""
    ),
    razorpaySecretKey: String(
      razorpayData.razorpaySecretKey || process.env.RAZORPAY_KEY_SECRET || ""
    ),
  }
}

async function getSmtpTransportFromConfig(config: RuntimeSecureConfig) {
  if (!config.smtpHost || !config.smtpUser || !config.smtpPass) return null
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  })
  try {
    await transporter.verify()
  } catch (error) {
    logger.error("SMTP verify failed", error)
    return null
  }
  return transporter
}

type AttendancePayload = {
  lat: number
  lng: number
  accuracy: number
  deviceInfo: string
}

function getNowParts(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  })
  const parts = formatter.formatToParts(now)
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  }
  const dateKey = `${map.year}${map.month}${map.day}`
  const currentMinutes = Number(map.hour) * 60 + Number(map.minute)
  return {
    dateKey,
    weekday: weekdayMap[map.weekday || "Mon"] || 1,
    currentMinutes,
  }
}

function toMinutes(hhmm: string): number {
  const [hh, mm] = hhmm.split(":").map(Number)
  return hh * 60 + mm
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const earthRadius = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadius * c
}

export const createSelfAttendance = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Please login first.")
  }
  const uid = request.auth.uid
  const payload = request.data as AttendancePayload
  if (
    !payload ||
    !Number.isFinite(payload.lat) ||
    !Number.isFinite(payload.lng) ||
    !Number.isFinite(payload.accuracy)
  ) {
    throw new HttpsError("invalid-argument", "Invalid location payload.")
  }

  const [userSnap, staffSnap] = await Promise.all([
    db.collection("users").doc(uid).get(),
    db.collection("staff").doc(uid).get(),
  ])
  if (!userSnap.exists) {
    throw new HttpsError("not-found", "User profile not found.")
  }
  if (userSnap.data()?.isBlocked) {
    throw new HttpsError(
      "permission-denied",
      "Your account is blocked. Contact admin."
    )
  }
  if (!staffSnap.exists) {
    throw new HttpsError("permission-denied", "Staff profile not found.")
  }

  const staff = staffSnap.data()
  if (!staff?.active) {
    throw new HttpsError("permission-denied", "You are inactive.")
  }

  let effectivePermissions: string[] = staff.effectivePermissions || []
  if (effectivePermissions.length === 0) {
    const roleIds = [staff.roleId, ...(staff.extraRoleIds || [])].filter(Boolean)
    const roleDocs = await Promise.all(
      roleIds.map((roleId: string) => db.collection("roles").doc(roleId).get())
    )
    effectivePermissions = roleDocs.flatMap((docSnap) =>
      (docSnap.data()?.permissions || []) as string[]
    )
  }

  if (!effectivePermissions.includes("ATTENDANCE_SELF_MARK")) {
    throw new HttpsError(
      "permission-denied",
      "Role does not have attendance self-mark permission."
    )
  }

  const [scheduleSnap, locationSnap] = await Promise.all([
    db.collection("schedules").doc(staff.scheduleId).get(),
    db.collection("workLocations").doc(staff.workLocationId).get(),
  ])
  if (!scheduleSnap.exists) {
    throw new HttpsError("failed-precondition", "Schedule is not assigned.")
  }
  if (!locationSnap.exists) {
    throw new HttpsError("failed-precondition", "Work location is not assigned.")
  }

  const schedule = scheduleSnap.data()
  const location = locationSnap.data()
  if (!schedule?.active || !location?.active) {
    throw new HttpsError(
      "failed-precondition",
      "Assigned schedule/location is inactive."
    )
  }

  const { dateKey, weekday, currentMinutes } = getNowParts()
  if (!(schedule.daysOfWeek || []).includes(weekday)) {
    throw new HttpsError(
      "failed-precondition",
      "Today is not an allowed working day."
    )
  }

  const startMinutes = toMinutes(schedule.startTime)
  const endMinutes = toMinutes(schedule.endTime)
  if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
    throw new HttpsError(
      "failed-precondition",
      "Attendance is outside allowed time window."
    )
  }

  const distanceMeters = haversineMeters(
    payload.lat,
    payload.lng,
    location.geoPoint.lat,
    location.geoPoint.lng
  )
  if (distanceMeters > Number(location.radiusMeters || 0)) {
    throw new HttpsError(
      "failed-precondition",
      "You are outside the allowed attendance radius."
    )
  }

  const attendanceId = `${uid}_${dateKey}_${staff.scheduleId}`
  const attendanceRef = db.collection("attendance").doc(attendanceId)

  await db.runTransaction(async (transaction) => {
    const existingSnap = await transaction.get(attendanceRef)
    if (existingSnap.exists) {
      throw new HttpsError(
        "already-exists",
        "Attendance already marked for this shift."
      )
    }
    const graceMinutes = Number(schedule.graceMinutes || 0)
    const lateCutoff = startMinutes + Math.max(0, graceMinutes)
    const status = currentMinutes > lateCutoff ? "LATE" : "PRESENT"
    transaction.set(attendanceRef, {
      userId: uid,
      roleId: staff.roleId,
      branchId: staff.branchId,
      scheduleId: staff.scheduleId,
      workLocationId: staff.workLocationId,
      dateKey,
      status,
      method: "SELF",
      capturedAt: admin.firestore.FieldValue.serverTimestamp(),
      geo: {
        lat: payload.lat,
        lng: payload.lng,
        accuracy: payload.accuracy,
      },
      distanceMeters: Math.round(distanceMeters),
      notes: "",
      createdBy: uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid,
    })
  })

  return {
    ok: true,
    message: "Attendance marked successfully.",
    dateKey,
  }
})

type VerifyBookingPayload = {
  intentId: string
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}

function toDateKey(value: string): string {
  return value.split("-").join("")
}

function nextInvoiceNumber(counter: number): string {
  const now = new Date()
  const year = now.getFullYear()
  return `INV-${year}-${String(counter).padStart(6, "0")}`
}

function isSlotBased(listingType: string) {
  return [
    "function_hall",
    "open_function_hall",
    "dining_hall",
    "local_tour",
  ].includes(listingType)
}

function buildCheckInOutSchedule(
  listingType: string,
  checkInDate: string
): {
  scheduledCheckInAt: admin.firestore.Timestamp
  scheduledCheckOutAt: admin.firestore.Timestamp
} {
  const start = new Date(`${checkInDate}T12:00:00`)
  const end = new Date(`${checkInDate}T11:00:00`)
  if (isSlotBased(listingType)) {
    const slotStart = new Date(`${checkInDate}T09:00:00`)
    const slotEnd = new Date(`${checkInDate}T23:59:00`)
    return {
      scheduledCheckInAt: admin.firestore.Timestamp.fromDate(slotStart),
      scheduledCheckOutAt: admin.firestore.Timestamp.fromDate(slotEnd),
    }
  }
  end.setDate(end.getDate() + 1)
  return {
    scheduledCheckInAt: admin.firestore.Timestamp.fromDate(start),
    scheduledCheckOutAt: admin.firestore.Timestamp.fromDate(end),
  }
}

async function allocateResourcesInTransaction(
  transaction: FirebaseFirestore.Transaction,
  params: {
    bookingRef: FirebaseFirestore.DocumentReference
    listingRef: FirebaseFirestore.DocumentReference
    listing: FirebaseFirestore.DocumentData
    dateKey: string
    slotId: string | null
    unitsBooked: number
    userId: string
  }
) {
  const { bookingRef, listingRef, listing, dateKey, slotId, unitsBooked, userId } = params
  const labels: string[] = []
  const reservationDocIds: string[] = []
  const listingType = String(listing.type || "function_hall")

  if (isSlotBased(listingType)) {
    const slotKey = slotId || "full_day"
    const reservationId = `${listingRef.id}_${dateKey}_${slotKey}`
    const reservationRef = db.collection("reservations").doc(reservationId)
    const reservationSnap = await transaction.get(reservationRef)
    const allocated = Number(reservationSnap.data()?.quantity || 0)
    const capacity = Number(listing.inventory || 1)
    if (allocated + unitsBooked > capacity) {
      throw new HttpsError(
        "failed-precondition",
        "Selected slot is fully booked. Please choose another slot."
      )
    }
    transaction.set(
      reservationRef,
      {
        listingId: listingRef.id,
        bookingId: bookingRef.id,
        userId,
        dateKey,
        slotId: slotKey,
        quantity: allocated + unitsBooked,
        status: "BOOKED",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    labels.push(slotId ? `Slot ${slotId}` : "Full Day Slot")
    reservationDocIds.push(reservationId)
    return {
      allocationType: listingType === "local_tour" ? "seats" : "slot",
      labels,
      reservationDocIds,
      slotId: slotId || null,
      quantity: unitsBooked,
      dateKey,
    }
  }

  const unitsQuery = listingRef.collection("units").where("active", "==", true).limit(200)
  const unitsSnap = await transaction.get(unitsQuery)
  if (!unitsSnap.empty) {
    const selectedUnitIds: string[] = []
    const unitCandidates = unitsSnap.docs.map((unitDoc) => {
      const reservationId = `${unitDoc.id}_${dateKey}`
      const reservationRef = db.collection("reservations").doc(reservationId)
      return { unitDoc, reservationId, reservationRef }
    })
    const reservationSnaps = await Promise.all(
      unitCandidates.map(({ reservationRef }) => transaction.get(reservationRef))
    )

    const selectedReservations: Array<{
      unitId: string
      unitLabel: string
      reservationId: string
      reservationRef: FirebaseFirestore.DocumentReference
    }> = []

    for (let index = 0; index < unitCandidates.length; index += 1) {
      if (selectedReservations.length >= unitsBooked) break
      const candidate = unitCandidates[index]
      const reservationSnap = reservationSnaps[index]
      if (!reservationSnap.exists) {
        selectedReservations.push({
          unitId: candidate.unitDoc.id,
          unitLabel: String(candidate.unitDoc.data().label || candidate.unitDoc.id),
          reservationId: candidate.reservationId,
          reservationRef: candidate.reservationRef,
        })
      }
    }
    if (selectedReservations.length < unitsBooked) {
      throw new HttpsError(
        "failed-precondition",
        "Not enough free units for selected date."
      )
    }

    for (const selected of selectedReservations) {
      selectedUnitIds.push(selected.unitId)
      labels.push(selected.unitLabel)
      reservationDocIds.push(selected.reservationId)
      transaction.set(selected.reservationRef, {
        listingId: listingRef.id,
        bookingId: bookingRef.id,
        userId,
        dateKey,
        unitId: selected.unitId,
        status: "BOOKED",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }

    return {
      allocationType: "units",
      unitIds: selectedUnitIds,
      labels,
      reservationDocIds,
      slotId: null,
      quantity: unitsBooked,
      dateKey,
    }
  }

  const inventoryReservationId = `${listingRef.id}_${dateKey}_inventory`
  const inventoryRef = db.collection("reservations").doc(inventoryReservationId)
  const inventorySnap = await transaction.get(inventoryRef)
  const allocated = Number(inventorySnap.data()?.quantity || 0)
  const capacity = Number(listing.inventory || 1)
  if (allocated + unitsBooked > capacity) {
    throw new HttpsError("failed-precondition", "Inventory unavailable for selected date.")
  }
  transaction.set(
    inventoryRef,
    {
      listingId: listingRef.id,
      bookingId: bookingRef.id,
      userId,
      dateKey,
      quantity: allocated + unitsBooked,
      status: "BOOKED",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  )
  labels.push(`Units: ${unitsBooked}`)
  reservationDocIds.push(inventoryReservationId)
  return {
    allocationType: "inventory",
    labels,
    reservationDocIds,
    slotId: null,
    quantity: unitsBooked,
    dateKey,
  }
}

async function generateInvoicePdfAndStore(
  invoiceId: string,
  invoiceData: FirebaseFirestore.DocumentData
) {
  const doc = new PDFDocument({ size: "A4", margin: 40 })
  const chunks: Uint8Array[] = []
  doc.on("data", (chunk: Buffer) => chunks.push(chunk))
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks.map((c) => Buffer.from(c)))))
  })

  doc.fontSize(18).text("Anga Function Hall", { align: "left" })
  doc.moveDown(0.4)
  doc.fontSize(11).text(`Invoice: ${invoiceData.invoiceNumber}`)
  doc.text(`Booking ID: ${invoiceData.bookingId}`)
  doc.text(`Issued At: ${new Date().toLocaleString("en-IN")}`)
  doc.moveDown()
  doc.fontSize(12).text("Customer", { underline: true })
  doc.fontSize(11).text(`${invoiceData.customer?.name || "Guest"}`)
  doc.text(`${invoiceData.customer?.email || ""}`)
  doc.text(`${invoiceData.customer?.phone || ""}`)
  doc.moveDown()
  doc.fontSize(12).text("Service", { underline: true })
  doc.fontSize(11).text(`${invoiceData.service?.listingTitle || "Listing"}`)
  doc.text(`Date: ${invoiceData.service?.dateKey || ""}`)
  doc.text(`Allocated: ${(invoiceData.service?.allocatedLabels || []).join(", ")}`)
  doc.moveDown()
  doc.fontSize(12).text("Price Breakdown", { underline: true })
  const breakdown = invoiceData.breakdown || {}
  doc.fontSize(11).text(`Base: INR ${Number(breakdown.basePrice || 0).toFixed(2)}`)
  doc.text(`Add-ons: INR ${Number(breakdown.addonsTotal || 0).toFixed(2)}`)
  doc.text(`Discount: INR ${Number(breakdown.couponDiscount || 0).toFixed(2)}`)
  doc.text(`Tax: INR ${Number(breakdown.taxAmount || 0).toFixed(2)}`)
  doc.text(`Fees: INR ${Number(breakdown.serviceFee || 0).toFixed(2)}`)
  doc.text(`Total: INR ${Number(breakdown.totalAmount || 0).toFixed(2)}`)
  doc.text(`Paid: INR ${Number(breakdown.paidAmount || 0).toFixed(2)}`)
  doc.text(`Due: INR ${Number(breakdown.dueAmount || 0).toFixed(2)}`)
  doc.end()

  const pdfBuffer = await done
  const bucket = admin.storage().bucket()
  const path = `invoices/${invoiceId}.pdf`
  const file = bucket.file(path)
  await file.save(pdfBuffer, {
    contentType: "application/pdf",
    metadata: {
      cacheControl: "private, max-age=0, no-transform",
    },
  })
  return path
}

function renderTemplate(
  template: string,
  values: Record<string, string | number>
) {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.split(`{${key}}`).join(String(value))
  }, template)
}

async function writeEmailLog(data: {
  bookingId: string
  invoiceId: string
  toEmail: string
  status: "SENT" | "FAILED" | "NOT_SENT"
  error?: string
  messageId?: string
}) {
  await db.collection("emailLogs").add({
    ...data,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  })
}

async function sendConfirmationEmail(
  invoiceData: FirebaseFirestore.DocumentData,
  bookingData: FirebaseFirestore.DocumentData,
  forceResend = false
) {
  if (!forceResend && String(bookingData.emailStatus || "") === "sent") {
    return "sent" as const
  }
  const runtimeConfig = await getRuntimeSecureConfig()
  const smtpTransport = await getSmtpTransportFromConfig(runtimeConfig)
  if (!smtpTransport) {
    await writeEmailLog({
      bookingId: String(bookingData.id || bookingData.bookingId || ""),
      invoiceId: String(bookingData.invoiceId || invoiceData.id || ""),
      toEmail: String(invoiceData.customer?.email || ""),
      status: "NOT_SENT",
      error: "SMTP transport is not configured",
    })
    return "pending" as const
  }

  const fromEmail = runtimeConfig.smtpFromEmail || runtimeConfig.smtpUser || ""
  const fromName = runtimeConfig.smtpFromName || "Anga Function Hall"
  const appBaseUrl = runtimeConfig.appBaseUrl || ""
  const toEmail = String(invoiceData.customer?.email || "")
  if (!toEmail) return "failed" as const

  const settingsSnap = await db.collection("settings").doc("global").get()
  const templateData = settingsSnap.data() || {}
  const defaultSubject = "Booking Confirmed - {invoiceNumber}"
  const defaultBody = `
    <p>Hello {userName},</p>
    <p>Your booking is confirmed.</p>
    <p><strong>Booking ID:</strong> {bookingId}</p>
    <p><strong>Invoice Number:</strong> {invoiceNumber}</p>
    <p><strong>Listing:</strong> {listingName}</p>
    <p><strong>Date:</strong> {dates}</p>
    <p><strong>Slot:</strong> {slots}</p>
    <p><strong>Allocated:</strong> {allocatedUnits}</p>
    <p><strong>Amount Paid:</strong> INR {amountPaid}</p>
    <p><a href="{invoiceLink}">Download Invoice</a></p>
  `
  const templateValues = {
    userName: String(invoiceData.customer?.name || "Guest"),
    bookingId: String(bookingData.id || bookingData.bookingId || ""),
    invoiceNumber: String(invoiceData.invoiceNumber || ""),
    listingName: String(bookingData.listingTitle || invoiceData.service?.listingTitle || ""),
    dates: String(invoiceData.service?.dateKey || ""),
    slots: String(bookingData.slotName || invoiceData.service?.slotName || ""),
    allocatedUnits: String(
      (bookingData.allocatedResource?.labels || invoiceData.service?.allocatedLabels || []).join(", ")
    ),
    amountPaid: Number(bookingData.advancePaid || invoiceData.breakdown?.paidAmount || 0).toFixed(2),
    invoiceLink: appBaseUrl
      ? `${appBaseUrl}/invoice/${invoiceData.id || bookingData.invoiceId || ""}`
      : "",
    supportLink: appBaseUrl,
  }

  const subjectTemplate = String(templateData.bookingEmailSubjectTemplate || defaultSubject)
  const bodyTemplate = String(templateData.bookingEmailHtmlTemplate || defaultBody)
  const subject = renderTemplate(subjectTemplate, templateValues)
  const html = renderTemplate(bodyTemplate, templateValues)

  let lastError = ""
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const attachments = []
      if (invoiceData.invoicePdfPath) {
        const [pdfBuffer] = await admin.storage().bucket().file(String(invoiceData.invoicePdfPath)).download()
        attachments.push({
          filename: `${invoiceData.invoiceNumber || "invoice"}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        })
      }
      const response = await smtpTransport.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: toEmail,
        subject,
        html,
        attachments,
      })
      await writeEmailLog({
        bookingId: String(bookingData.id || bookingData.bookingId || ""),
        invoiceId: String(bookingData.invoiceId || invoiceData.id || ""),
        toEmail,
        status: "SENT",
        messageId: String(response.messageId || ""),
      })
      if (runtimeConfig.adminNotificationEmail) {
        await smtpTransport.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: runtimeConfig.adminNotificationEmail,
          subject: `Booking Email Sent - ${templateValues.bookingId}`,
          html: `<p>Booking confirmation email sent to ${toEmail} for booking ${templateValues.bookingId}.</p>`,
        })
      }
      return "sent" as const
    } catch (error) {
      lastError = error instanceof Error ? error.message : "SMTP error"
      if (attempt === 3) break
    }
  }

  await writeEmailLog({
    bookingId: String(bookingData.id || bookingData.bookingId || ""),
    invoiceId: String(bookingData.invoiceId || invoiceData.id || ""),
    toEmail,
    status: "FAILED",
    error: lastError,
  })
  return "failed" as const
}

async function sendCheckoutEmail(
  bookingData: Record<string, any>,
  invoiceData: Record<string, any>
) {
  const runtimeConfig = await getRuntimeSecureConfig()
  const smtpTransport = await getSmtpTransportFromConfig(runtimeConfig)
  if (!smtpTransport) return "pending" as const
  const toEmail = String(invoiceData.customer?.email || "")
  if (!toEmail) return "failed" as const

  const settingsSnap = await db.collection("settings").doc("global").get()
  const settings = (settingsSnap.data() || {}) as Record<string, any>
  const defaultSubject = "Checkout Confirmed - {bookingId}"
  const defaultBody =
    "<p>Hello {userName},</p><p>Your checkout is confirmed.</p><p><strong>Booking ID:</strong> {bookingId}</p><p><strong>Invoice:</strong> {invoiceNumber}</p><p><strong>Listing:</strong> {listingName}</p><p><strong>Allocated:</strong> {allocation}</p><p><strong>Check-out time:</strong> {checkOutAt}</p><p>Thank you for staying with us.</p>"
  const templateValues = {
    userName: String(invoiceData.customer?.name || "Guest"),
    bookingId: String(bookingData.id || ""),
    invoiceNumber: String(bookingData.invoiceNumber || invoiceData.invoiceNumber || ""),
    listingName: String(bookingData.listingTitle || ""),
    allocation: String((bookingData.allocatedResource?.labels || []).join(", ")),
    checkOutAt: new Date().toLocaleString("en-IN"),
  }
  const subject = renderTemplate(
    String(settings.checkoutEmailSubjectTemplate || defaultSubject),
    templateValues
  )
  const html = renderTemplate(
    String(settings.checkoutEmailHtmlTemplate || defaultBody),
    templateValues
  )

  try {
    const response = await smtpTransport.sendMail({
      from: `"${runtimeConfig.smtpFromName || "Anga Function Hall"}" <${runtimeConfig.smtpFromEmail || runtimeConfig.smtpUser}>`,
      to: toEmail,
      subject,
      html,
    })
    await writeEmailLog({
      bookingId: String(bookingData.id || ""),
      invoiceId: String(bookingData.invoiceId || ""),
      toEmail,
      status: "SENT",
      messageId: String(response.messageId || ""),
    })
    return "sent" as const
  } catch (error) {
    await writeEmailLog({
      bookingId: String(bookingData.id || ""),
      invoiceId: String(bookingData.invoiceId || ""),
      toEmail,
      status: "FAILED",
      error: error instanceof Error ? error.message : "Checkout email failed",
    })
    return "failed" as const
  }
}

async function finalizeCheckout(params: {
  bookingId: string
  actorId: string
  method: "USER" | "ADMIN" | "AUTO"
  note?: string
}) {
  const { bookingId, actorId, method, note } = params
  const bookingRef = db.collection("bookings").doc(bookingId)
  const bookingSnap = await bookingRef.get()
  if (!bookingSnap.exists) {
    throw new HttpsError("not-found", "Booking not found.")
  }
  const bookingData = { id: bookingSnap.id, ...(bookingSnap.data() || {}) } as Record<string, any>
  if (["checked_out", "cancelled", "no_show"].includes(String(bookingData.status || ""))) {
    return { ok: true, idempotent: true, bookingId, status: bookingData.status }
  }
  if (!["confirmed", "checked_in"].includes(String(bookingData.status || ""))) {
    throw new HttpsError("failed-precondition", "Booking cannot be checked out in current state.")
  }

  await db.runTransaction(async (transaction) => {
    const latestBooking = await transaction.get(bookingRef)
    const latest = latestBooking.data() || {}
    if (["checked_out", "cancelled", "no_show"].includes(String(latest.status || ""))) {
      return
    }
    transaction.set(
      bookingRef,
      {
        status: "checked_out",
        checkOutAt: admin.firestore.FieldValue.serverTimestamp(),
        checkedOutBy: actorId,
        checkoutMethod: method,
        checkoutNotes: note || "",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )

    const reservationsQuery = db.collection("reservations").where("bookingId", "==", bookingId)
    const reservationsSnap = await transaction.get(reservationsQuery)
    reservationsSnap.forEach((reservationDoc) => {
      transaction.set(
        reservationDoc.ref,
        {
          status: "COMPLETED",
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    })

    const checkEventRef = db.collection("checkEvents").doc()
    transaction.set(checkEventRef, {
      bookingId,
      type: "CHECKOUT",
      method,
      actorId,
      note: note || "",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })

    const auditRef = db.collection("auditLogs").doc()
    transaction.set(auditRef, {
      entity: "booking",
      entityId: bookingId,
      action: "CHECKOUT",
      message: `Booking checked out (${method})`,
      payload: { method, note: note || "" },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: actorId,
    })
  })

  if (bookingData.invoiceId) {
    const invoiceSnap = await db.collection("invoices").doc(String(bookingData.invoiceId)).get()
    if (invoiceSnap.exists) {
      const checkoutEmailStatus = await sendCheckoutEmail(
        bookingData,
        { id: invoiceSnap.id, ...(invoiceSnap.data() || {}) } as Record<string, any>
      )
      await bookingRef.set(
        {
          checkoutEmailStatus,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    }
  }

  return { ok: true, bookingId, status: "checked_out", idempotent: false }
}

export const verifyPaymentAndConfirmBooking = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Please login first.")
  }
  const uid = request.auth.uid
  const payload = request.data as VerifyBookingPayload
  if (
    !payload?.intentId ||
    !payload?.razorpayOrderId ||
    !payload?.razorpayPaymentId ||
    !payload?.razorpaySignature
  ) {
    throw new HttpsError("invalid-argument", "Missing payment verification fields.")
  }

  const intentRef = db.collection("bookingIntents").doc(payload.intentId)
  const existingIntent = await intentRef.get()
  if (!existingIntent.exists) {
    throw new HttpsError("not-found", "Booking intent not found.")
  }
  const existingIntentData = existingIntent.data() || {}
  if (existingIntentData.userId !== uid) {
    throw new HttpsError("permission-denied", "Intent does not belong to this user.")
  }
  const runtimeConfig = await getRuntimeSecureConfig()

  if (existingIntentData.status === "consumed" && existingIntentData.bookingId) {
    const bookingSnap = await db.collection("bookings").doc(existingIntentData.bookingId).get()
    if (bookingSnap.exists) {
      const booking = { id: bookingSnap.id, ...(bookingSnap.data() || {}) } as Record<string, any>
      const invoicePdfUrl =
        booking.invoiceId && runtimeConfig.appBaseUrl
          ? `${runtimeConfig.appBaseUrl}/invoice/${String(booking.invoiceId)}`
          : ""
      return {
        ok: true,
        idempotent: true,
        bookingId: booking.id,
        invoiceId: booking.invoiceId || "",
        invoiceNumber: booking.invoiceNumber || "",
        invoicePdfUrl,
        allocatedLabels: booking.allocatedResource?.labels || [],
        emailStatus: booking.emailStatus || "pending",
      }
    }
  }

  const razorpaySecret = runtimeConfig.razorpaySecretKey
  if (!runtimeConfig.razorpayKeyId || !razorpaySecret) {
    throw new HttpsError("failed-precondition", "Razorpay keys are not configured.")
  }
  const rawPayload = `${payload.razorpayOrderId}|${payload.razorpayPaymentId}`
  const expected = createHmac("sha256", razorpaySecret).update(rawPayload).digest("hex")
  const expectedBuffer = Buffer.from(expected, "utf8")
  const receivedBuffer = Buffer.from(payload.razorpaySignature, "utf8")
  const signatureOk =
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  if (!signatureOk) {
    throw new HttpsError("permission-denied", "Razorpay signature verification failed.")
  }

  const razorpay = new Razorpay({
    key_id: runtimeConfig.razorpayKeyId || "",
    key_secret: razorpaySecret,
  })
  const order = await razorpay.orders.fetch(payload.razorpayOrderId)
  if (!order || Number(order.amount) !== Number(existingIntentData.razorpayAmount || 0)) {
    throw new HttpsError("failed-precondition", "Paid amount mismatch.")
  }

  let transactionResult: {
    idempotent: boolean
    bookingId: string
    invoiceId: string
    invoiceNumber: string
    allocatedLabels: string[]
  }
  try {
    transactionResult = await db.runTransaction(async (transaction) => {
    const intentSnap = await transaction.get(intentRef)
    if (!intentSnap.exists) {
      throw new HttpsError("not-found", "Booking intent not found.")
    }
    const intent = intentSnap.data() || {}
    if (intent.userId !== uid) {
      throw new HttpsError("permission-denied", "Intent ownership mismatch.")
    }
    if (intent.status === "consumed" && intent.bookingId) {
      return {
        idempotent: true,
        bookingId: String(intent.bookingId),
        invoiceId: String(intent.invoiceId || ""),
        invoiceNumber: String(intent.invoiceNumber || ""),
        allocatedLabels: [] as string[],
      }
    }
    if (intent.status !== "created" && intent.status !== "verified") {
      throw new HttpsError("failed-precondition", "Booking intent is not payable.")
    }
    if (String(intent.razorpayOrderId || "") !== payload.razorpayOrderId) {
      throw new HttpsError("failed-precondition", "Order mismatch.")
    }

    const userRef = db.collection("users").doc(uid)
    const listingRef = db.collection("listings").doc(String(intent.listingId))
    const branchRef = db.collection("branches").doc(String(intent.branchId))
    const couponId = intent.couponId ? String(intent.couponId) : ""
    const couponRef = couponId ? db.collection("coupons").doc(couponId) : null

    const [userSnap, listingSnap, branchSnap, couponSnap] = await Promise.all([
      transaction.get(userRef),
      transaction.get(listingRef),
      transaction.get(branchRef),
      couponRef ? transaction.get(couponRef) : Promise.resolve(null),
    ])
    if (!userSnap.exists) throw new HttpsError("not-found", "User profile not found.")
    if (userSnap.data()?.isBlocked) {
      throw new HttpsError("permission-denied", "Blocked user cannot confirm booking.")
    }
    if (!listingSnap.exists) throw new HttpsError("not-found", "Listing not found.")
    if (!branchSnap.exists) throw new HttpsError("not-found", "Branch not found.")

    const listing = listingSnap.data() || {}
    const unitsBooked = Math.max(1, Number(intent.unitsBooked || 1))
    const dateKey = toDateKey(String(intent.checkInDate || ""))
    const schedule = buildCheckInOutSchedule(
      String(listing.type || "function_hall"),
      String(intent.checkInDate || "")
    )
    const bookingRef = db.collection("bookings").doc()
    const paymentRef = db.collection("payments").doc()
    const invoiceRef = db.collection("invoices").doc()
    const counterRef = db.collection("counters").doc("invoices")
    const now = admin.firestore.FieldValue.serverTimestamp()

    const allocation = await allocateResourcesInTransaction(transaction, {
      bookingRef,
      listingRef,
      listing,
      dateKey,
      slotId: intent.slotId || null,
      unitsBooked,
      userId: uid,
    })

    const counterSnap = await transaction.get(counterRef)
    const currentCounter = Number(counterSnap.data()?.value || 0) + 1
    const invoiceNumber = nextInvoiceNumber(currentCounter)
    transaction.set(counterRef, { value: currentCounter }, { merge: true })

    const pricing = intent.pricing || {}
    const paymentStatus =
      Number(pricing.dueAmount || 0) > 0 ? "advance_paid" : "fully_paid"

    transaction.set(paymentRef, {
      bookingId: bookingRef.id,
      userId: uid,
      listingId: intent.listingId,
      branchId: intent.branchId,
      amount: Number(pricing.amountToPay || 0),
      totalAmount: Number(pricing.totalAmount || 0),
      currency: "INR",
      status: "captured",
      gateway: "razorpay",
      verified: true,
      razorpayOrderId: payload.razorpayOrderId,
      razorpayPaymentId: payload.razorpayPaymentId,
      createdAt: now,
      updatedAt: now,
    })

    transaction.set(invoiceRef, {
      invoiceNumber,
      bookingId: bookingRef.id,
      userId: uid,
      issuedAt: now,
      customer: {
        name: String(userSnap.data()?.displayName || "Guest"),
        email: String(userSnap.data()?.email || ""),
        phone: String(userSnap.data()?.phone || ""),
      },
      service: {
        listingId: intent.listingId,
        listingTitle: String(listing.title || "Listing"),
        listingType: String(listing.type || "function_hall"),
        dateKey,
        slotName: intent.slotName || null,
        allocatedLabels: allocation.labels || [],
      },
      breakdown: {
        basePrice: Number(pricing.basePrice || 0),
        addonsTotal: Number(pricing.addonsTotal || 0),
        couponDiscount: Number(pricing.couponDiscount || 0),
        taxAmount: Number(pricing.taxAmount || 0),
        serviceFee: Number(pricing.serviceFee || 0),
        totalAmount: Number(pricing.totalAmount || 0),
        paidAmount: Number(pricing.amountToPay || 0),
        dueAmount: Number(pricing.dueAmount || 0),
      },
      payment: {
        razorpayOrderId: payload.razorpayOrderId,
        razorpayPaymentId: payload.razorpayPaymentId,
      },
      emailStatus: "pending",
      createdAt: now,
      updatedAt: now,
    })

    transaction.set(bookingRef, {
      userId: uid,
      listingId: intent.listingId,
      branchId: intent.branchId,
      listingType: listing.type || "function_hall",
      listingTitle: listing.title || "Listing",
      branchName: branchSnap.data()?.name || "",
      checkInDate: admin.firestore.Timestamp.fromDate(new Date(intent.checkInDate)),
      checkOutDate: null,
      slotId: intent.slotId || null,
      slotName: intent.slotName || null,
      guestCount: Math.max(1, Number(intent.guestCount || 1)),
      unitsBooked,
      selectedAddons: intent.selectedAddons || [],
      basePrice: Number(pricing.basePrice || 0),
      addonsTotal: Number(pricing.addonsTotal || 0),
      couponDiscount: Number(pricing.couponDiscount || 0),
      taxAmount: Number(pricing.taxAmount || 0),
      serviceFee: Number(pricing.serviceFee || 0),
      totalAmount: Number(pricing.totalAmount || 0),
      advancePaid: Number(pricing.amountToPay || 0),
      dueAmount: Number(pricing.dueAmount || 0),
      status: "confirmed",
      paymentStatus,
      paymentVerified: true,
      razorpayOrderId: payload.razorpayOrderId,
      razorpayPaymentId: payload.razorpayPaymentId,
      invoiceId: invoiceRef.id,
      invoiceNumber,
      allocatedResource: allocation,
      emailStatus: "pending",
      checkoutEmailStatus: "pending",
      scheduledCheckInAt: schedule.scheduledCheckInAt,
      scheduledCheckOutAt: schedule.scheduledCheckOutAt,
      checkInAt: null,
      checkOutAt: null,
      checkedInBy: null,
      checkedOutBy: null,
      checkoutMethod: null,
      checkoutNotes: "",
      confirmedAt: now,
      cancelledAt: null,
      refundAmount: 0,
      refundStatus: "none",
      createdAt: now,
      updatedAt: now,
    })

    transaction.update(intentRef, {
      status: "consumed",
      bookingId: bookingRef.id,
      paymentId: paymentRef.id,
      invoiceId: invoiceRef.id,
      invoiceNumber,
      verifiedAt: now,
      finalizedAt: now,
    })

    if (couponRef && couponSnap?.exists) {
        transaction.update(couponRef, {
          usedCount: Number(couponSnap.data()?.usedCount || 0) + 1,
        })
    }

    return {
      idempotent: false,
      bookingId: bookingRef.id,
      invoiceId: invoiceRef.id,
      invoiceNumber,
      allocatedLabels: allocation.labels || [],
    }
    })
  } catch (error) {
    const message =
      error instanceof HttpsError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Allocation failed"
    await intentRef.set(
      {
        status: "manual_resolution",
        manualResolutionReason: message,
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    throw error
  }

  const invoiceRef = db.collection("invoices").doc(transactionResult.invoiceId)
  const bookingRef = db.collection("bookings").doc(transactionResult.bookingId)
  const [invoiceSnap, bookingSnap] = await Promise.all([invoiceRef.get(), bookingRef.get()])

  let invoicePdfPath = ""
  let invoicePdfUrl = ""
  let emailStatus: "pending" | "sent" | "failed" = "pending"
  if (invoiceSnap.exists && bookingSnap.exists) {
    const invoiceData = {
      id: invoiceSnap.id,
      ...(invoiceSnap.data() || {}),
    } as Record<string, any>
    const bookingData = {
      id: bookingSnap.id,
      ...(bookingSnap.data() || {}),
    } as Record<string, any>
    try {
      invoicePdfPath = await generateInvoicePdfAndStore(invoiceSnap.id, invoiceData)
      await invoiceRef.set(
        {
          invoicePdfPath,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      invoiceData.invoicePdfPath = invoicePdfPath
    } catch {
      // Keep confirmation successful even if PDF generation fails.
    }
    try {
      emailStatus = await sendConfirmationEmail(invoiceData, bookingData)
      await Promise.all([
        invoiceRef.set(
          {
            emailStatus,
            emailSentAt:
              emailStatus === "sent" ? admin.firestore.FieldValue.serverTimestamp() : null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        ),
        bookingRef.set(
          {
            emailStatus,
            emailSentAt:
              emailStatus === "sent" ? admin.firestore.FieldValue.serverTimestamp() : null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        ),
      ])
    } catch {
      emailStatus = "failed"
      await Promise.all([
        invoiceRef.set(
          { emailStatus, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        ),
        bookingRef.set(
          { emailStatus, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        ),
      ])
    }
    if (runtimeConfig.appBaseUrl) {
      invoicePdfUrl = `${runtimeConfig.appBaseUrl}/invoice/${invoiceSnap.id}`
    }
  }

  return {
    ok: true,
    bookingId: transactionResult.bookingId,
    invoiceId: transactionResult.invoiceId,
    invoiceNumber: transactionResult.invoiceNumber,
    invoicePdfUrl,
    allocatedLabels: transactionResult.allocatedLabels || [],
    emailStatus,
    idempotent: transactionResult.idempotent,
  }
})

export const processInvoiceCreated = onDocumentCreated(
  "invoices/{invoiceId}",
  async (event) => {
    const snap = event.data
    if (!snap) return
    const data = snap.data()
    if (!data || data.invoicePdfPath) return
    try {
      const pdfPath = await generateInvoicePdfAndStore(snap.id, data)
      await snap.ref.set(
        {
          invoicePdfPath: pdfPath,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    } catch {
      // noop: best-effort fallback trigger
    }
  }
)

export const resendBookingConfirmationEmail = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Please login first.")
  }
  const uid = request.auth.uid
  const bookingId = String(request.data?.bookingId || "")
  const forceResend = Boolean(request.data?.forceResend)
  if (!bookingId) {
    throw new HttpsError("invalid-argument", "bookingId is required.")
  }
  const userSnap = await db.collection("users").doc(uid).get()
  const userRole = String(userSnap.data()?.role || "user")
  if (userRole !== "admin") {
    throw new HttpsError("permission-denied", "Only admin can resend confirmation email.")
  }

  const bookingSnap = await db.collection("bookings").doc(bookingId).get()
  if (!bookingSnap.exists) {
    throw new HttpsError("not-found", "Booking not found.")
  }
  const bookingData = { id: bookingSnap.id, ...(bookingSnap.data() || {}) } as Record<string, any>
  const invoiceId = String(bookingData.invoiceId || "")
  if (!invoiceId) {
    throw new HttpsError("failed-precondition", "No invoice found for booking.")
  }
  const invoiceRef = db.collection("invoices").doc(invoiceId)
  const invoiceSnap = await invoiceRef.get()
  if (!invoiceSnap.exists) {
    throw new HttpsError("not-found", "Invoice not found.")
  }
  const invoiceData = {
    id: invoiceSnap.id,
    ...(invoiceSnap.data() || {}),
  } as Record<string, any>
  if (!forceResend && String(bookingData.emailStatus || "") === "sent") {
    return { ok: true, emailStatus: "sent", skipped: true }
  }
  let emailStatus: "pending" | "sent" | "failed" = "pending"
  try {
    emailStatus = await sendConfirmationEmail(invoiceData, bookingData, forceResend)
  } catch {
    emailStatus = "failed"
  }
  await Promise.all([
    invoiceRef.set(
      {
        emailStatus,
        emailSentAt:
          emailStatus === "sent" ? admin.firestore.FieldValue.serverTimestamp() : null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
    bookingSnap.ref.set(
      {
        emailStatus,
        emailSentAt:
          emailStatus === "sent" ? admin.firestore.FieldValue.serverTimestamp() : null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
  ])
  return { ok: true, emailStatus }
})

export const adminCheckIn = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Please login first.")
  }
  const uid = request.auth.uid
  const bookingId = String(request.data?.bookingId || "")
  if (!bookingId) {
    throw new HttpsError("invalid-argument", "bookingId is required.")
  }
  const userSnap = await db.collection("users").doc(uid).get()
  if (String(userSnap.data()?.role || "") !== "admin") {
    throw new HttpsError("permission-denied", "Only admin can mark check-in.")
  }
  const bookingRef = db.collection("bookings").doc(bookingId)
  const bookingSnap = await bookingRef.get()
  if (!bookingSnap.exists) {
    throw new HttpsError("not-found", "Booking not found.")
  }
  const booking = bookingSnap.data() || {}
  if (String(booking.status || "") === "checked_in") {
    return { ok: true, bookingId, idempotent: true }
  }
  if (String(booking.status || "") !== "confirmed") {
    throw new HttpsError("failed-precondition", "Only confirmed booking can be checked-in.")
  }
  await bookingRef.set(
    {
      status: "checked_in",
      checkInAt: admin.firestore.FieldValue.serverTimestamp(),
      checkedInBy: uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  )
  await db.collection("checkEvents").add({
    bookingId,
    type: "CHECKIN",
    method: "ADMIN",
    actorId: uid,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  })
  await db.collection("auditLogs").add({
    entity: "booking",
    entityId: bookingId,
    action: "CHECKIN",
    message: "Admin check-in",
    payload: {},
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: uid,
  })
  return { ok: true, bookingId }
})

export const adminCheckOut = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Please login first.")
  }
  const uid = request.auth.uid
  const bookingId = String(request.data?.bookingId || "")
  const note = String(request.data?.note || "")
  if (!bookingId) {
    throw new HttpsError("invalid-argument", "bookingId is required.")
  }
  const userSnap = await db.collection("users").doc(uid).get()
  if (String(userSnap.data()?.role || "") !== "admin") {
    throw new HttpsError("permission-denied", "Only admin can check out.")
  }
  return finalizeCheckout({ bookingId, actorId: uid, method: "ADMIN", note })
})

export const userCheckOut = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Please login first.")
  }
  const uid = request.auth.uid
  const bookingId = String(request.data?.bookingId || "")
  if (!bookingId) {
    throw new HttpsError("invalid-argument", "bookingId is required.")
  }
  const bookingSnap = await db.collection("bookings").doc(bookingId).get()
  if (!bookingSnap.exists) {
    throw new HttpsError("not-found", "Booking not found.")
  }
  const booking = bookingSnap.data() || {}
  if (String(booking.userId || "") !== uid) {
    throw new HttpsError("permission-denied", "Not allowed.")
  }
  const now = Date.now()
  const scheduledCheckInAt = booking.scheduledCheckInAt?.toDate?.()?.getTime?.() || 0
  if (now < scheduledCheckInAt) {
    throw new HttpsError("failed-precondition", "Checkout is not allowed before check-in window.")
  }
  return finalizeCheckout({ bookingId, actorId: uid, method: "USER" })
})

export const resendCheckoutEmail = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Please login first.")
  }
  const uid = request.auth.uid
  const bookingId = String(request.data?.bookingId || "")
  if (!bookingId) {
    throw new HttpsError("invalid-argument", "bookingId is required.")
  }
  const userSnap = await db.collection("users").doc(uid).get()
  if (String(userSnap.data()?.role || "") !== "admin") {
    throw new HttpsError("permission-denied", "Only admin can resend checkout email.")
  }
  const bookingSnap = await db.collection("bookings").doc(bookingId).get()
  if (!bookingSnap.exists) {
    throw new HttpsError("not-found", "Booking not found.")
  }
  const booking = { id: bookingSnap.id, ...(bookingSnap.data() || {}) } as Record<string, any>
  if (!booking.invoiceId) {
    throw new HttpsError("failed-precondition", "No invoice attached.")
  }
  const invoiceSnap = await db.collection("invoices").doc(String(booking.invoiceId)).get()
  if (!invoiceSnap.exists) {
    throw new HttpsError("not-found", "Invoice not found.")
  }
  const status = await sendCheckoutEmail(
    booking,
    { id: invoiceSnap.id, ...(invoiceSnap.data() || {}) } as Record<string, any>
  )
  await bookingSnap.ref.set(
    {
      checkoutEmailStatus: status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  )
  return { ok: true, checkoutEmailStatus: status }
})

export const scheduledAutoCheckoutJob = onSchedule("every 10 minutes", async () => {
  const now = new Date()
  const snap = await db.collection("bookings").get()
  const due = snap.docs.filter((docSnap) => {
    const data = docSnap.data() || {}
    const status = String(data.status || "")
    if (!["confirmed", "checked_in"].includes(status)) return false
    const scheduled = data.scheduledCheckOutAt?.toDate?.()
    if (!scheduled) return false
    return scheduled.getTime() <= now.getTime()
  })

  for (const docSnap of due) {
    try {
      await finalizeCheckout({
        bookingId: docSnap.id,
        actorId: "system:auto-checkout",
        method: "AUTO",
        note: "Auto checkout by scheduler",
      })
    } catch (error) {
      logger.error("Auto checkout failed", { bookingId: docSnap.id, error })
    }
  }
})

export const getInvoiceDownloadUrl = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Please login first.")
  }
  const uid = request.auth.uid
  const invoiceId = String(request.data?.invoiceId || "")
  if (!invoiceId) {
    throw new HttpsError("invalid-argument", "invoiceId is required.")
  }

  const [invoiceSnap, userSnap] = await Promise.all([
    db.collection("invoices").doc(invoiceId).get(),
    db.collection("users").doc(uid).get(),
  ])
  if (!invoiceSnap.exists) {
    throw new HttpsError("not-found", "Invoice not found.")
  }
  const invoice = invoiceSnap.data() || {}
  const isAdminUser = String(userSnap.data()?.role || "") === "admin"
  const isOwner = String(invoice.userId || "") === uid
  if (!isAdminUser && !isOwner) {
    throw new HttpsError("permission-denied", "Not allowed to access this invoice.")
  }
  const pdfPath = String(invoice.invoicePdfPath || "")
  if (!pdfPath) {
    throw new HttpsError("failed-precondition", "Invoice PDF is not ready.")
  }
  const [url] = await admin.storage().bucket().file(pdfPath).getSignedUrl({
    action: "read",
    expires: Date.now() + 15 * 60 * 1000,
  })
  return { ok: true, url }
})
