"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInvoiceDownloadUrl = exports.scheduledAutoCheckoutJob = exports.resendCheckoutEmail = exports.userCheckOut = exports.adminCheckOut = exports.adminCheckIn = exports.resendBookingConfirmationEmail = exports.processInvoiceCreated = exports.verifyPaymentAndConfirmBooking = exports.createSelfAttendance = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const logger = __importStar(require("firebase-functions/logger"));
const node_crypto_1 = require("node:crypto");
const pdfkit_1 = __importDefault(require("pdfkit"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const razorpay_1 = __importDefault(require("razorpay"));
admin.initializeApp();
const db = admin.firestore();
const TIMEZONE = "Asia/Kolkata";
async function getRuntimeSecureConfig() {
    const [smtpSnap, razorpaySnap, settingsSnap] = await Promise.all([
        db.collection("secureSettings").doc("smtp").get(),
        db.collection("secureSettings").doc("razorpay").get(),
        db.collection("settings").doc("global").get(),
    ]);
    const smtpData = (smtpSnap.data() || {});
    const razorpayData = (razorpaySnap.data() || {});
    const settingsData = (settingsSnap.data() || {});
    return {
        smtpHost: String(smtpData.smtpHost || process.env.SMTP_HOST || ""),
        smtpPort: Number(smtpData.smtpPort || process.env.SMTP_PORT || 587),
        smtpSecure: String(smtpData.smtpSecure ?? process.env.SMTP_SECURE ?? "false").toLowerCase() ===
            "true",
        smtpUser: String(smtpData.smtpUser || process.env.SMTP_USER || ""),
        smtpPass: String(smtpData.smtpPass || process.env.SMTP_PASS || ""),
        smtpFromName: String(smtpData.smtpFromName || process.env.SMTP_FROM_NAME || "Anga Function Hall"),
        smtpFromEmail: String(smtpData.smtpFromEmail || process.env.SMTP_FROM_EMAIL || ""),
        adminNotificationEmail: String(smtpData.adminNotificationEmail || process.env.ADMIN_NOTIFICATION_EMAIL || ""),
        appBaseUrl: String(smtpData.appBaseUrl || process.env.APP_BASE_URL || ""),
        razorpayKeyId: String(settingsData.razorpayKeyId || process.env.RAZORPAY_KEY_ID || ""),
        razorpaySecretKey: String(razorpayData.razorpaySecretKey || process.env.RAZORPAY_KEY_SECRET || ""),
    };
}
async function getSmtpTransportFromConfig(config) {
    if (!config.smtpHost || !config.smtpUser || !config.smtpPass)
        return null;
    const transporter = nodemailer_1.default.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: {
            user: config.smtpUser,
            pass: config.smtpPass,
        },
    });
    try {
        await transporter.verify();
    }
    catch (error) {
        logger.error("SMTP verify failed", error);
        return null;
    }
    return transporter;
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
    });
    const parts = formatter.formatToParts(now);
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const weekdayMap = {
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
        Sun: 7,
    };
    const dateKey = `${map.year}${map.month}${map.day}`;
    const currentMinutes = Number(map.hour) * 60 + Number(map.minute);
    return {
        dateKey,
        weekday: weekdayMap[map.weekday || "Mon"] || 1,
        currentMinutes,
    };
}
function toMinutes(hhmm) {
    const [hh, mm] = hhmm.split(":").map(Number);
    return hh * 60 + mm;
}
function haversineMeters(lat1, lng1, lat2, lng2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const earthRadius = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadius * c;
}
exports.createSelfAttendance = (0, https_1.onCall)(async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Please login first.");
    }
    const uid = request.auth.uid;
    const payload = request.data;
    if (!payload ||
        !Number.isFinite(payload.lat) ||
        !Number.isFinite(payload.lng) ||
        !Number.isFinite(payload.accuracy)) {
        throw new https_1.HttpsError("invalid-argument", "Invalid location payload.");
    }
    const [userSnap, staffSnap] = await Promise.all([
        db.collection("users").doc(uid).get(),
        db.collection("staff").doc(uid).get(),
    ]);
    if (!userSnap.exists) {
        throw new https_1.HttpsError("not-found", "User profile not found.");
    }
    if (userSnap.data()?.isBlocked) {
        throw new https_1.HttpsError("permission-denied", "Your account is blocked. Contact admin.");
    }
    if (!staffSnap.exists) {
        throw new https_1.HttpsError("permission-denied", "Staff profile not found.");
    }
    const staff = staffSnap.data();
    if (!staff?.active) {
        throw new https_1.HttpsError("permission-denied", "You are inactive.");
    }
    let effectivePermissions = staff.effectivePermissions || [];
    if (effectivePermissions.length === 0) {
        const roleIds = [staff.roleId, ...(staff.extraRoleIds || [])].filter(Boolean);
        const roleDocs = await Promise.all(roleIds.map((roleId) => db.collection("roles").doc(roleId).get()));
        effectivePermissions = roleDocs.flatMap((docSnap) => (docSnap.data()?.permissions || []));
    }
    if (!effectivePermissions.includes("ATTENDANCE_SELF_MARK")) {
        throw new https_1.HttpsError("permission-denied", "Role does not have attendance self-mark permission.");
    }
    const [scheduleSnap, locationSnap] = await Promise.all([
        db.collection("schedules").doc(staff.scheduleId).get(),
        db.collection("workLocations").doc(staff.workLocationId).get(),
    ]);
    if (!scheduleSnap.exists) {
        throw new https_1.HttpsError("failed-precondition", "Schedule is not assigned.");
    }
    if (!locationSnap.exists) {
        throw new https_1.HttpsError("failed-precondition", "Work location is not assigned.");
    }
    const schedule = scheduleSnap.data();
    const location = locationSnap.data();
    if (!schedule?.active || !location?.active) {
        throw new https_1.HttpsError("failed-precondition", "Assigned schedule/location is inactive.");
    }
    const { dateKey, weekday, currentMinutes } = getNowParts();
    if (!(schedule.daysOfWeek || []).includes(weekday)) {
        throw new https_1.HttpsError("failed-precondition", "Today is not an allowed working day.");
    }
    const startMinutes = toMinutes(schedule.startTime);
    const endMinutes = toMinutes(schedule.endTime);
    if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
        throw new https_1.HttpsError("failed-precondition", "Attendance is outside allowed time window.");
    }
    const distanceMeters = haversineMeters(payload.lat, payload.lng, location.geoPoint.lat, location.geoPoint.lng);
    if (distanceMeters > Number(location.radiusMeters || 0)) {
        throw new https_1.HttpsError("failed-precondition", "You are outside the allowed attendance radius.");
    }
    const attendanceId = `${uid}_${dateKey}_${staff.scheduleId}`;
    const attendanceRef = db.collection("attendance").doc(attendanceId);
    await db.runTransaction(async (transaction) => {
        const existingSnap = await transaction.get(attendanceRef);
        if (existingSnap.exists) {
            throw new https_1.HttpsError("already-exists", "Attendance already marked for this shift.");
        }
        const graceMinutes = Number(schedule.graceMinutes || 0);
        const lateCutoff = startMinutes + Math.max(0, graceMinutes);
        const status = currentMinutes > lateCutoff ? "LATE" : "PRESENT";
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
        });
    });
    return {
        ok: true,
        message: "Attendance marked successfully.",
        dateKey,
    };
});
function toDateKey(value) {
    return value.split("-").join("");
}
function nextInvoiceNumber(counter) {
    const now = new Date();
    const year = now.getFullYear();
    return `INV-${year}-${String(counter).padStart(6, "0")}`;
}
function isSlotBased(listingType) {
    return [
        "function_hall",
        "open_function_hall",
        "dining_hall",
        "local_tour",
    ].includes(listingType);
}
function buildCheckInOutSchedule(listingType, checkInDate) {
    const start = new Date(`${checkInDate}T12:00:00`);
    const end = new Date(`${checkInDate}T11:00:00`);
    if (isSlotBased(listingType)) {
        const slotStart = new Date(`${checkInDate}T09:00:00`);
        const slotEnd = new Date(`${checkInDate}T23:59:00`);
        return {
            scheduledCheckInAt: admin.firestore.Timestamp.fromDate(slotStart),
            scheduledCheckOutAt: admin.firestore.Timestamp.fromDate(slotEnd),
        };
    }
    end.setDate(end.getDate() + 1);
    return {
        scheduledCheckInAt: admin.firestore.Timestamp.fromDate(start),
        scheduledCheckOutAt: admin.firestore.Timestamp.fromDate(end),
    };
}
async function allocateResourcesInTransaction(transaction, params) {
    const { bookingRef, listingRef, listing, dateKey, lockDate, slotId, unitsBooked, userId } = params;
    const labels = [];
    const reservationDocIds = [];
    const listingType = String(listing.type || "function_hall");
    const roomResourceId = !isSlotBased(listingType) && String(listing.roomId || "").trim()
        ? String(listing.roomId).trim().toUpperCase()
        : listingRef.id;
    if (isSlotBased(listingType)) {
        const slotKey = slotId || "full_day";
        const reservationId = `${listingRef.id}_${dateKey}_${slotKey}`;
        const reservationRef = db.collection("reservations").doc(reservationId);
        const lockRef = db.collection("availabilityLocks").doc(reservationId);
        const reservationSnap = await transaction.get(reservationRef);
        const lockSnap = await transaction.get(lockRef);
        const allocated = Number(reservationSnap.data()?.quantity || 0);
        const capacity = Number(listing.inventory || 1);
        if (allocated + unitsBooked > capacity) {
            throw new https_1.HttpsError("failed-precondition", "Selected slot is fully booked. Please choose another slot.");
        }
        transaction.set(reservationRef, {
            listingId: listingRef.id,
            bookingId: bookingRef.id,
            userId,
            dateKey,
            slotId: slotKey,
            quantity: allocated + unitsBooked,
            status: "BOOKED",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.set(lockRef, {
            listingId: listingRef.id,
            date: lockDate,
            slotId: slotKey,
            bookedUnits: allocated + unitsBooked,
            maxUnits: capacity,
            isBlocked: Boolean(lockSnap.data()?.isBlocked || false),
            bookingIds: [bookingRef.id],
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        labels.push(slotId ? `Slot ${slotId}` : "Full Day Slot");
        reservationDocIds.push(reservationId);
        return {
            allocationType: listingType === "local_tour" ? "seats" : "slot",
            labels,
            reservationDocIds,
            slotId: slotId || null,
            quantity: unitsBooked,
            dateKey,
        };
    }
    const unitsQuery = listingRef.collection("units").where("active", "==", true).limit(200);
    const unitsSnap = await transaction.get(unitsQuery);
    if (!unitsSnap.empty) {
        const selectedUnitIds = [];
        const defaultLockId = `${roomResourceId}_${dateKey}_default`;
        const defaultLockRef = db.collection("availabilityLocks").doc(defaultLockId);
        const unitCandidates = unitsSnap.docs.map((unitDoc) => {
            const reservationId = `${unitDoc.id}_${dateKey}`;
            const reservationRef = db.collection("reservations").doc(reservationId);
            return { unitDoc, reservationId, reservationRef };
        });
        const reservationSnaps = await Promise.all(unitCandidates.map(({ reservationRef }) => transaction.get(reservationRef)));
        const defaultLockSnap = await transaction.get(defaultLockRef);
        const selectedReservations = [];
        for (let index = 0; index < unitCandidates.length; index += 1) {
            if (selectedReservations.length >= unitsBooked)
                break;
            const candidate = unitCandidates[index];
            const reservationSnap = reservationSnaps[index];
            if (!reservationSnap.exists) {
                selectedReservations.push({
                    unitId: candidate.unitDoc.id,
                    unitLabel: String(candidate.unitDoc.data().label || candidate.unitDoc.id),
                    reservationId: candidate.reservationId,
                    reservationRef: candidate.reservationRef,
                });
            }
        }
        if (selectedReservations.length < unitsBooked) {
            throw new https_1.HttpsError("failed-precondition", "Not enough free units for selected date.");
        }
        for (const selected of selectedReservations) {
            selectedUnitIds.push(selected.unitId);
            labels.push(selected.unitLabel);
            reservationDocIds.push(selected.reservationId);
            transaction.set(selected.reservationRef, {
                listingId: roomResourceId,
                bookingId: bookingRef.id,
                userId,
                dateKey,
                unitId: selected.unitId,
                status: "BOOKED",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        const currentBooked = Number(defaultLockSnap.data()?.bookedUnits || 0);
        const capacity = Number(listing.inventory || unitsSnap.docs.length || unitsBooked);
        transaction.set(defaultLockRef, {
            listingId: roomResourceId,
            date: lockDate,
            slotId: "default",
            bookedUnits: currentBooked + selectedReservations.length,
            maxUnits: capacity,
            isBlocked: Boolean(defaultLockSnap.data()?.isBlocked || false),
            bookingIds: [bookingRef.id],
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return {
            allocationType: "units",
            unitIds: selectedUnitIds,
            labels,
            reservationDocIds,
            slotId: null,
            quantity: unitsBooked,
            dateKey,
        };
    }
    const inventoryReservationId = `${roomResourceId}_${dateKey}_inventory`;
    const inventoryRef = db.collection("reservations").doc(inventoryReservationId);
    const defaultLockId = `${roomResourceId}_${dateKey}_default`;
    const defaultLockRef = db.collection("availabilityLocks").doc(defaultLockId);
    const inventorySnap = await transaction.get(inventoryRef);
    const defaultLockSnap = await transaction.get(defaultLockRef);
    const allocated = Number(inventorySnap.data()?.quantity || 0);
    const capacity = Number(listing.inventory || 1);
    if (allocated + unitsBooked > capacity) {
        throw new https_1.HttpsError("failed-precondition", "Inventory unavailable for selected date.");
    }
    transaction.set(inventoryRef, {
        listingId: roomResourceId,
        bookingId: bookingRef.id,
        userId,
        dateKey,
        quantity: allocated + unitsBooked,
        status: "BOOKED",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(defaultLockRef, {
        listingId: roomResourceId,
        date: lockDate,
        slotId: "default",
        bookedUnits: allocated + unitsBooked,
        maxUnits: capacity,
        isBlocked: Boolean(defaultLockSnap.data()?.isBlocked || false),
        bookingIds: [bookingRef.id],
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    labels.push(`Units: ${unitsBooked}`);
    reservationDocIds.push(inventoryReservationId);
    return {
        allocationType: "inventory",
        labels,
        reservationDocIds,
        slotId: null,
        quantity: unitsBooked,
        dateKey,
    };
}
async function generateInvoicePdfAndStore(invoiceId, invoiceData) {
    const doc = new pdfkit_1.default({ size: "A4", margin: 40 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    const done = new Promise((resolve) => {
        doc.on("end", () => resolve(Buffer.concat(chunks.map((c) => Buffer.from(c)))));
    });
    doc.fontSize(18).text("Anga Function Hall", { align: "left" });
    doc.moveDown(0.4);
    doc.fontSize(11).text(`Invoice: ${invoiceData.invoiceNumber}`);
    doc.text(`Booking ID: ${invoiceData.bookingId}`);
    doc.text(`Issued At: ${new Date().toLocaleString("en-IN")}`);
    doc.moveDown();
    doc.fontSize(12).text("Customer", { underline: true });
    doc.fontSize(11).text(`${invoiceData.customer?.name || "Guest"}`);
    doc.text(`${invoiceData.customer?.email || ""}`);
    doc.text(`${invoiceData.customer?.phone || ""}`);
    doc.moveDown();
    doc.fontSize(12).text("Service", { underline: true });
    doc.fontSize(11).text(`${invoiceData.service?.listingTitle || "Listing"}`);
    doc.text(`Date: ${invoiceData.service?.dateKey || ""}`);
    doc.text(`Allocated: ${(invoiceData.service?.allocatedLabels || []).join(", ")}`);
    doc.moveDown();
    doc.fontSize(12).text("Price Breakdown", { underline: true });
    const breakdown = invoiceData.breakdown || {};
    doc.fontSize(11).text(`Base: INR ${Number(breakdown.basePrice || 0).toFixed(2)}`);
    doc.text(`Add-ons: INR ${Number(breakdown.addonsTotal || 0).toFixed(2)}`);
    doc.text(`Discount: INR ${Number(breakdown.couponDiscount || 0).toFixed(2)}`);
    doc.text(`Tax: INR ${Number(breakdown.taxAmount || 0).toFixed(2)}`);
    doc.text(`Fees: INR ${Number(breakdown.serviceFee || 0).toFixed(2)}`);
    doc.text(`Total: INR ${Number(breakdown.totalAmount || 0).toFixed(2)}`);
    doc.text(`Paid: INR ${Number(breakdown.paidAmount || 0).toFixed(2)}`);
    doc.text(`Due: INR ${Number(breakdown.dueAmount || 0).toFixed(2)}`);
    doc.end();
    const pdfBuffer = await done;
    const bucket = admin.storage().bucket();
    const path = `invoices/${invoiceId}.pdf`;
    const file = bucket.file(path);
    await file.save(pdfBuffer, {
        contentType: "application/pdf",
        metadata: {
            cacheControl: "private, max-age=0, no-transform",
        },
    });
    return path;
}
function renderTemplate(template, values) {
    return Object.entries(values).reduce((result, [key, value]) => {
        return result.split(`{${key}}`).join(String(value));
    }, template);
}
async function writeEmailLog(data) {
    await db.collection("emailLogs").add({
        ...data,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
}
async function sendConfirmationEmail(invoiceData, bookingData, forceResend = false) {
    if (!forceResend && String(bookingData.emailStatus || "") === "sent") {
        return "sent";
    }
    const runtimeConfig = await getRuntimeSecureConfig();
    const smtpTransport = await getSmtpTransportFromConfig(runtimeConfig);
    if (!smtpTransport) {
        await writeEmailLog({
            bookingId: String(bookingData.id || bookingData.bookingId || ""),
            invoiceId: String(bookingData.invoiceId || invoiceData.id || ""),
            toEmail: String(invoiceData.customer?.email || ""),
            status: "NOT_SENT",
            error: "SMTP transport is not configured",
        });
        return "pending";
    }
    const fromEmail = runtimeConfig.smtpFromEmail || runtimeConfig.smtpUser || "";
    const fromName = runtimeConfig.smtpFromName || "Anga Function Hall";
    const appBaseUrl = runtimeConfig.appBaseUrl || "";
    const toEmail = String(invoiceData.customer?.email || "");
    if (!toEmail)
        return "failed";
    const settingsSnap = await db.collection("settings").doc("global").get();
    const templateData = settingsSnap.data() || {};
    const defaultSubject = "Booking Confirmed - {invoiceNumber}";
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
  `;
    const templateValues = {
        userName: String(invoiceData.customer?.name || "Guest"),
        bookingId: String(bookingData.id || bookingData.bookingId || ""),
        invoiceNumber: String(invoiceData.invoiceNumber || ""),
        listingName: String(bookingData.listingTitle || invoiceData.service?.listingTitle || ""),
        dates: String(invoiceData.service?.dateKey || ""),
        slots: String(bookingData.slotName || invoiceData.service?.slotName || ""),
        allocatedUnits: String((bookingData.allocatedResource?.labels || invoiceData.service?.allocatedLabels || []).join(", ")),
        amountPaid: Number(bookingData.advancePaid || invoiceData.breakdown?.paidAmount || 0).toFixed(2),
        invoiceLink: appBaseUrl
            ? `${appBaseUrl}/invoice/${invoiceData.id || bookingData.invoiceId || ""}`
            : "",
        supportLink: appBaseUrl,
    };
    const subjectTemplate = String(templateData.bookingEmailSubjectTemplate || defaultSubject);
    const bodyTemplate = String(templateData.bookingEmailHtmlTemplate || defaultBody);
    const subject = renderTemplate(subjectTemplate, templateValues);
    const html = renderTemplate(bodyTemplate, templateValues);
    let lastError = "";
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            const attachments = [];
            if (invoiceData.invoicePdfPath) {
                const [pdfBuffer] = await admin.storage().bucket().file(String(invoiceData.invoicePdfPath)).download();
                attachments.push({
                    filename: `${invoiceData.invoiceNumber || "invoice"}.pdf`,
                    content: pdfBuffer,
                    contentType: "application/pdf",
                });
            }
            const response = await smtpTransport.sendMail({
                from: `"${fromName}" <${fromEmail}>`,
                to: toEmail,
                subject,
                html,
                attachments,
            });
            await writeEmailLog({
                bookingId: String(bookingData.id || bookingData.bookingId || ""),
                invoiceId: String(bookingData.invoiceId || invoiceData.id || ""),
                toEmail,
                status: "SENT",
                messageId: String(response.messageId || ""),
            });
            if (runtimeConfig.adminNotificationEmail) {
                await smtpTransport.sendMail({
                    from: `"${fromName}" <${fromEmail}>`,
                    to: runtimeConfig.adminNotificationEmail,
                    subject: `Booking Email Sent - ${templateValues.bookingId}`,
                    html: `<p>Booking confirmation email sent to ${toEmail} for booking ${templateValues.bookingId}.</p>`,
                });
            }
            return "sent";
        }
        catch (error) {
            lastError = error instanceof Error ? error.message : "SMTP error";
            if (attempt === 3)
                break;
        }
    }
    await writeEmailLog({
        bookingId: String(bookingData.id || bookingData.bookingId || ""),
        invoiceId: String(bookingData.invoiceId || invoiceData.id || ""),
        toEmail,
        status: "FAILED",
        error: lastError,
    });
    return "failed";
}
async function sendCheckoutEmail(bookingData, invoiceData) {
    const runtimeConfig = await getRuntimeSecureConfig();
    const smtpTransport = await getSmtpTransportFromConfig(runtimeConfig);
    if (!smtpTransport)
        return "pending";
    const toEmail = String(invoiceData.customer?.email || "");
    if (!toEmail)
        return "failed";
    const settingsSnap = await db.collection("settings").doc("global").get();
    const settings = (settingsSnap.data() || {});
    const defaultSubject = "Checkout Confirmed - {bookingId}";
    const defaultBody = "<p>Hello {userName},</p><p>Your checkout is confirmed.</p><p><strong>Booking ID:</strong> {bookingId}</p><p><strong>Invoice:</strong> {invoiceNumber}</p><p><strong>Listing:</strong> {listingName}</p><p><strong>Allocated:</strong> {allocation}</p><p><strong>Check-out time:</strong> {checkOutAt}</p><p>Thank you for staying with us.</p>";
    const templateValues = {
        userName: String(invoiceData.customer?.name || "Guest"),
        bookingId: String(bookingData.id || ""),
        invoiceNumber: String(bookingData.invoiceNumber || invoiceData.invoiceNumber || ""),
        listingName: String(bookingData.listingTitle || ""),
        allocation: String((bookingData.allocatedResource?.labels || []).join(", ")),
        checkOutAt: new Date().toLocaleString("en-IN"),
    };
    const subject = renderTemplate(String(settings.checkoutEmailSubjectTemplate || defaultSubject), templateValues);
    const html = renderTemplate(String(settings.checkoutEmailHtmlTemplate || defaultBody), templateValues);
    try {
        const response = await smtpTransport.sendMail({
            from: `"${runtimeConfig.smtpFromName || "Anga Function Hall"}" <${runtimeConfig.smtpFromEmail || runtimeConfig.smtpUser}>`,
            to: toEmail,
            subject,
            html,
        });
        await writeEmailLog({
            bookingId: String(bookingData.id || ""),
            invoiceId: String(bookingData.invoiceId || ""),
            toEmail,
            status: "SENT",
            messageId: String(response.messageId || ""),
        });
        return "sent";
    }
    catch (error) {
        await writeEmailLog({
            bookingId: String(bookingData.id || ""),
            invoiceId: String(bookingData.invoiceId || ""),
            toEmail,
            status: "FAILED",
            error: error instanceof Error ? error.message : "Checkout email failed",
        });
        return "failed";
    }
}
async function finalizeCheckout(params) {
    const { bookingId, actorId, method, note } = params;
    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) {
        throw new https_1.HttpsError("not-found", "Booking not found.");
    }
    const bookingData = { id: bookingSnap.id, ...(bookingSnap.data() || {}) };
    if (["checked_out", "cancelled", "no_show"].includes(String(bookingData.status || ""))) {
        return { ok: true, idempotent: true, bookingId, status: bookingData.status };
    }
    if (!["confirmed", "checked_in"].includes(String(bookingData.status || ""))) {
        throw new https_1.HttpsError("failed-precondition", "Booking cannot be checked out in current state.");
    }
    await db.runTransaction(async (transaction) => {
        const latestBooking = await transaction.get(bookingRef);
        const latest = latestBooking.data() || {};
        if (["checked_out", "cancelled", "no_show"].includes(String(latest.status || ""))) {
            return;
        }
        transaction.set(bookingRef, {
            status: "checked_out",
            checkOutAt: admin.firestore.FieldValue.serverTimestamp(),
            checkedOutBy: actorId,
            checkoutMethod: method,
            checkoutNotes: note || "",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        const reservationsQuery = db.collection("reservations").where("bookingId", "==", bookingId);
        const reservationsSnap = await transaction.get(reservationsQuery);
        reservationsSnap.forEach((reservationDoc) => {
            transaction.set(reservationDoc.ref, {
                status: "COMPLETED",
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        });
        const checkEventRef = db.collection("checkEvents").doc();
        transaction.set(checkEventRef, {
            bookingId,
            type: "CHECKOUT",
            method,
            actorId,
            note: note || "",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        const auditRef = db.collection("auditLogs").doc();
        transaction.set(auditRef, {
            entity: "booking",
            entityId: bookingId,
            action: "CHECKOUT",
            message: `Booking checked out (${method})`,
            payload: { method, note: note || "" },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: actorId,
        });
    });
    if (bookingData.invoiceId) {
        const invoiceSnap = await db.collection("invoices").doc(String(bookingData.invoiceId)).get();
        if (invoiceSnap.exists) {
            const checkoutEmailStatus = await sendCheckoutEmail(bookingData, { id: invoiceSnap.id, ...(invoiceSnap.data() || {}) });
            await bookingRef.set({
                checkoutEmailStatus,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
    }
    return { ok: true, bookingId, status: "checked_out", idempotent: false };
}
exports.verifyPaymentAndConfirmBooking = (0, https_1.onCall)(async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Please login first.");
    }
    const uid = request.auth.uid;
    const payload = request.data;
    if (!payload?.intentId ||
        !payload?.razorpayOrderId ||
        !payload?.razorpayPaymentId ||
        !payload?.razorpaySignature) {
        throw new https_1.HttpsError("invalid-argument", "Missing payment verification fields.");
    }
    const intentRef = db.collection("bookingIntents").doc(payload.intentId);
    const existingIntent = await intentRef.get();
    if (!existingIntent.exists) {
        throw new https_1.HttpsError("not-found", "Booking intent not found.");
    }
    const existingIntentData = existingIntent.data() || {};
    if (existingIntentData.userId !== uid) {
        throw new https_1.HttpsError("permission-denied", "Intent does not belong to this user.");
    }
    const runtimeConfig = await getRuntimeSecureConfig();
    if (existingIntentData.status === "consumed" && existingIntentData.bookingId) {
        const bookingSnap = await db.collection("bookings").doc(existingIntentData.bookingId).get();
        if (bookingSnap.exists) {
            const booking = { id: bookingSnap.id, ...(bookingSnap.data() || {}) };
            const invoicePdfUrl = booking.invoiceId && runtimeConfig.appBaseUrl
                ? `${runtimeConfig.appBaseUrl}/invoice/${String(booking.invoiceId)}`
                : "";
            return {
                ok: true,
                idempotent: true,
                bookingId: booking.id,
                invoiceId: booking.invoiceId || "",
                invoiceNumber: booking.invoiceNumber || "",
                invoicePdfUrl,
                allocatedLabels: booking.allocatedResource?.labels || [],
                emailStatus: booking.emailStatus || "pending",
            };
        }
    }
    const razorpaySecret = runtimeConfig.razorpaySecretKey;
    if (!runtimeConfig.razorpayKeyId || !razorpaySecret) {
        throw new https_1.HttpsError("failed-precondition", "Razorpay keys are not configured.");
    }
    const rawPayload = `${payload.razorpayOrderId}|${payload.razorpayPaymentId}`;
    const expected = (0, node_crypto_1.createHmac)("sha256", razorpaySecret).update(rawPayload).digest("hex");
    const expectedBuffer = Buffer.from(expected, "utf8");
    const receivedBuffer = Buffer.from(payload.razorpaySignature, "utf8");
    const signatureOk = expectedBuffer.length === receivedBuffer.length &&
        (0, node_crypto_1.timingSafeEqual)(expectedBuffer, receivedBuffer);
    if (!signatureOk) {
        throw new https_1.HttpsError("permission-denied", "Razorpay signature verification failed.");
    }
    const razorpay = new razorpay_1.default({
        key_id: runtimeConfig.razorpayKeyId || "",
        key_secret: razorpaySecret,
    });
    const order = await razorpay.orders.fetch(payload.razorpayOrderId);
    if (!order || Number(order.amount) !== Number(existingIntentData.razorpayAmount || 0)) {
        throw new https_1.HttpsError("failed-precondition", "Paid amount mismatch.");
    }
    let transactionResult;
    try {
        transactionResult = await db.runTransaction(async (transaction) => {
            const intentSnap = await transaction.get(intentRef);
            if (!intentSnap.exists) {
                throw new https_1.HttpsError("not-found", "Booking intent not found.");
            }
            const intent = intentSnap.data() || {};
            if (intent.userId !== uid) {
                throw new https_1.HttpsError("permission-denied", "Intent ownership mismatch.");
            }
            if (intent.status === "consumed" && intent.bookingId) {
                return {
                    idempotent: true,
                    bookingId: String(intent.bookingId),
                    invoiceId: String(intent.invoiceId || ""),
                    invoiceNumber: String(intent.invoiceNumber || ""),
                    allocatedLabels: [],
                };
            }
            if (intent.status !== "created" && intent.status !== "verified") {
                throw new https_1.HttpsError("failed-precondition", "Booking intent is not payable.");
            }
            if (String(intent.razorpayOrderId || "") !== payload.razorpayOrderId) {
                throw new https_1.HttpsError("failed-precondition", "Order mismatch.");
            }
            const userRef = db.collection("users").doc(uid);
            const listingRef = db.collection("listings").doc(String(intent.listingId));
            const branchRef = db.collection("branches").doc(String(intent.branchId));
            const couponId = intent.couponId ? String(intent.couponId) : "";
            const couponRef = couponId ? db.collection("coupons").doc(couponId) : null;
            const [userSnap, listingSnap, branchSnap, couponSnap] = await Promise.all([
                transaction.get(userRef),
                transaction.get(listingRef),
                transaction.get(branchRef),
                couponRef ? transaction.get(couponRef) : Promise.resolve(null),
            ]);
            if (!userSnap.exists)
                throw new https_1.HttpsError("not-found", "User profile not found.");
            if (userSnap.data()?.isBlocked) {
                throw new https_1.HttpsError("permission-denied", "Blocked user cannot confirm booking.");
            }
            if (!listingSnap.exists)
                throw new https_1.HttpsError("not-found", "Listing not found.");
            if (!branchSnap.exists)
                throw new https_1.HttpsError("not-found", "Branch not found.");
            const listing = listingSnap.data() || {};
            const unitsBooked = Math.max(1, Number(intent.unitsBooked || 1));
            const dateKey = toDateKey(String(intent.checkInDate || ""));
            const lockDate = String(intent.checkInDate || "");
            const schedule = buildCheckInOutSchedule(String(listing.type || "function_hall"), String(intent.checkInDate || ""));
            const bookingRef = db.collection("bookings").doc();
            const paymentRef = db.collection("payments").doc();
            const invoiceRef = db.collection("invoices").doc();
            const counterRef = db.collection("counters").doc("invoices");
            const now = admin.firestore.FieldValue.serverTimestamp();
            const counterSnap = await transaction.get(counterRef);
            const currentCounter = Number(counterSnap.data()?.value || 0) + 1;
            const invoiceNumber = nextInvoiceNumber(currentCounter);
            const allocation = await allocateResourcesInTransaction(transaction, {
                bookingRef,
                listingRef,
                listing,
                dateKey,
                lockDate,
                slotId: intent.slotId || null,
                unitsBooked,
                userId: uid,
            });
            transaction.set(counterRef, { value: currentCounter }, { merge: true });
            const pricing = intent.pricing || {};
            const paymentStatus = Number(pricing.dueAmount || 0) > 0 ? "advance_paid" : "fully_paid";
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
            });
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
            });
            transaction.set(bookingRef, {
                userId: uid,
                listingId: intent.listingId,
                roomId: String(listing.roomId || ""),
                roomNumber: String(listing.roomNumber || ""),
                roomTypeDetail: String(listing.roomTypeDetail || "ac") === "non_ac" ? "non_ac" : "ac",
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
            });
            transaction.update(intentRef, {
                status: "consumed",
                bookingId: bookingRef.id,
                paymentId: paymentRef.id,
                invoiceId: invoiceRef.id,
                invoiceNumber,
                verifiedAt: now,
                finalizedAt: now,
            });
            if (couponRef && couponSnap?.exists) {
                transaction.update(couponRef, {
                    usedCount: Number(couponSnap.data()?.usedCount || 0) + 1,
                });
            }
            return {
                idempotent: false,
                bookingId: bookingRef.id,
                invoiceId: invoiceRef.id,
                invoiceNumber,
                allocatedLabels: allocation.labels || [],
            };
        });
    }
    catch (error) {
        const message = error instanceof https_1.HttpsError
            ? error.message
            : error instanceof Error
                ? error.message
                : "Allocation failed";
        await intentRef.set({
            status: "manual_resolution",
            manualResolutionReason: message,
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        throw error;
    }
    const invoiceRef = db.collection("invoices").doc(transactionResult.invoiceId);
    const bookingRef = db.collection("bookings").doc(transactionResult.bookingId);
    const [invoiceSnap, bookingSnap] = await Promise.all([invoiceRef.get(), bookingRef.get()]);
    let invoicePdfPath = "";
    let invoicePdfUrl = "";
    let emailStatus = "pending";
    if (invoiceSnap.exists && bookingSnap.exists) {
        const invoiceData = {
            id: invoiceSnap.id,
            ...(invoiceSnap.data() || {}),
        };
        const bookingData = {
            id: bookingSnap.id,
            ...(bookingSnap.data() || {}),
        };
        try {
            invoicePdfPath = await generateInvoicePdfAndStore(invoiceSnap.id, invoiceData);
            await invoiceRef.set({
                invoicePdfPath,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            invoiceData.invoicePdfPath = invoicePdfPath;
        }
        catch {
            // Keep confirmation successful even if PDF generation fails.
        }
        try {
            emailStatus = await sendConfirmationEmail(invoiceData, bookingData);
            await Promise.all([
                invoiceRef.set({
                    emailStatus,
                    emailSentAt: emailStatus === "sent" ? admin.firestore.FieldValue.serverTimestamp() : null,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true }),
                bookingRef.set({
                    emailStatus,
                    emailSentAt: emailStatus === "sent" ? admin.firestore.FieldValue.serverTimestamp() : null,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true }),
            ]);
        }
        catch {
            emailStatus = "failed";
            await Promise.all([
                invoiceRef.set({ emailStatus, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }),
                bookingRef.set({ emailStatus, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }),
            ]);
        }
        if (runtimeConfig.appBaseUrl) {
            invoicePdfUrl = `${runtimeConfig.appBaseUrl}/invoice/${invoiceSnap.id}`;
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
    };
});
exports.processInvoiceCreated = (0, firestore_1.onDocumentCreated)("invoices/{invoiceId}", async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const data = snap.data();
    if (!data || data.invoicePdfPath)
        return;
    try {
        const pdfPath = await generateInvoicePdfAndStore(snap.id, data);
        await snap.ref.set({
            invoicePdfPath: pdfPath,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    catch {
        // noop: best-effort fallback trigger
    }
});
exports.resendBookingConfirmationEmail = (0, https_1.onCall)(async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Please login first.");
    }
    const uid = request.auth.uid;
    const bookingId = String(request.data?.bookingId || "");
    const forceResend = Boolean(request.data?.forceResend);
    if (!bookingId) {
        throw new https_1.HttpsError("invalid-argument", "bookingId is required.");
    }
    const userSnap = await db.collection("users").doc(uid).get();
    const userRole = String(userSnap.data()?.role || "user");
    if (userRole !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Only admin can resend confirmation email.");
    }
    const bookingSnap = await db.collection("bookings").doc(bookingId).get();
    if (!bookingSnap.exists) {
        throw new https_1.HttpsError("not-found", "Booking not found.");
    }
    const bookingData = { id: bookingSnap.id, ...(bookingSnap.data() || {}) };
    const invoiceId = String(bookingData.invoiceId || "");
    if (!invoiceId) {
        throw new https_1.HttpsError("failed-precondition", "No invoice found for booking.");
    }
    const invoiceRef = db.collection("invoices").doc(invoiceId);
    const invoiceSnap = await invoiceRef.get();
    if (!invoiceSnap.exists) {
        throw new https_1.HttpsError("not-found", "Invoice not found.");
    }
    const invoiceData = {
        id: invoiceSnap.id,
        ...(invoiceSnap.data() || {}),
    };
    if (!forceResend && String(bookingData.emailStatus || "") === "sent") {
        return { ok: true, emailStatus: "sent", skipped: true };
    }
    let emailStatus = "pending";
    try {
        emailStatus = await sendConfirmationEmail(invoiceData, bookingData, forceResend);
    }
    catch {
        emailStatus = "failed";
    }
    await Promise.all([
        invoiceRef.set({
            emailStatus,
            emailSentAt: emailStatus === "sent" ? admin.firestore.FieldValue.serverTimestamp() : null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true }),
        bookingSnap.ref.set({
            emailStatus,
            emailSentAt: emailStatus === "sent" ? admin.firestore.FieldValue.serverTimestamp() : null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true }),
    ]);
    return { ok: true, emailStatus };
});
exports.adminCheckIn = (0, https_1.onCall)(async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Please login first.");
    }
    const uid = request.auth.uid;
    const bookingId = String(request.data?.bookingId || "");
    if (!bookingId) {
        throw new https_1.HttpsError("invalid-argument", "bookingId is required.");
    }
    const userSnap = await db.collection("users").doc(uid).get();
    if (String(userSnap.data()?.role || "") !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Only admin can mark check-in.");
    }
    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) {
        throw new https_1.HttpsError("not-found", "Booking not found.");
    }
    const booking = bookingSnap.data() || {};
    if (String(booking.status || "") === "checked_in") {
        return { ok: true, bookingId, idempotent: true };
    }
    if (String(booking.status || "") !== "confirmed") {
        throw new https_1.HttpsError("failed-precondition", "Only confirmed booking can be checked-in.");
    }
    await bookingRef.set({
        status: "checked_in",
        checkInAt: admin.firestore.FieldValue.serverTimestamp(),
        checkedInBy: uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await db.collection("checkEvents").add({
        bookingId,
        type: "CHECKIN",
        method: "ADMIN",
        actorId: uid,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    await db.collection("auditLogs").add({
        entity: "booking",
        entityId: bookingId,
        action: "CHECKIN",
        message: "Admin check-in",
        payload: {},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: uid,
    });
    return { ok: true, bookingId };
});
exports.adminCheckOut = (0, https_1.onCall)(async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Please login first.");
    }
    const uid = request.auth.uid;
    const bookingId = String(request.data?.bookingId || "");
    const note = String(request.data?.note || "");
    if (!bookingId) {
        throw new https_1.HttpsError("invalid-argument", "bookingId is required.");
    }
    const userSnap = await db.collection("users").doc(uid).get();
    if (String(userSnap.data()?.role || "") !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Only admin can check out.");
    }
    return finalizeCheckout({ bookingId, actorId: uid, method: "ADMIN", note });
});
exports.userCheckOut = (0, https_1.onCall)(async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Please login first.");
    }
    const uid = request.auth.uid;
    const bookingId = String(request.data?.bookingId || "");
    if (!bookingId) {
        throw new https_1.HttpsError("invalid-argument", "bookingId is required.");
    }
    const bookingSnap = await db.collection("bookings").doc(bookingId).get();
    if (!bookingSnap.exists) {
        throw new https_1.HttpsError("not-found", "Booking not found.");
    }
    const booking = bookingSnap.data() || {};
    if (String(booking.userId || "") !== uid) {
        throw new https_1.HttpsError("permission-denied", "Not allowed.");
    }
    const now = Date.now();
    const scheduledCheckInAt = booking.scheduledCheckInAt?.toDate?.()?.getTime?.() || 0;
    if (now < scheduledCheckInAt) {
        throw new https_1.HttpsError("failed-precondition", "Checkout is not allowed before check-in window.");
    }
    return finalizeCheckout({ bookingId, actorId: uid, method: "USER" });
});
exports.resendCheckoutEmail = (0, https_1.onCall)(async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Please login first.");
    }
    const uid = request.auth.uid;
    const bookingId = String(request.data?.bookingId || "");
    if (!bookingId) {
        throw new https_1.HttpsError("invalid-argument", "bookingId is required.");
    }
    const userSnap = await db.collection("users").doc(uid).get();
    if (String(userSnap.data()?.role || "") !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Only admin can resend checkout email.");
    }
    const bookingSnap = await db.collection("bookings").doc(bookingId).get();
    if (!bookingSnap.exists) {
        throw new https_1.HttpsError("not-found", "Booking not found.");
    }
    const booking = { id: bookingSnap.id, ...(bookingSnap.data() || {}) };
    if (!booking.invoiceId) {
        throw new https_1.HttpsError("failed-precondition", "No invoice attached.");
    }
    const invoiceSnap = await db.collection("invoices").doc(String(booking.invoiceId)).get();
    if (!invoiceSnap.exists) {
        throw new https_1.HttpsError("not-found", "Invoice not found.");
    }
    const status = await sendCheckoutEmail(booking, { id: invoiceSnap.id, ...(invoiceSnap.data() || {}) });
    await bookingSnap.ref.set({
        checkoutEmailStatus: status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { ok: true, checkoutEmailStatus: status };
});
exports.scheduledAutoCheckoutJob = (0, scheduler_1.onSchedule)("every 10 minutes", async () => {
    const now = new Date();
    const snap = await db.collection("bookings").get();
    const due = snap.docs.filter((docSnap) => {
        const data = docSnap.data() || {};
        const status = String(data.status || "");
        if (!["confirmed", "checked_in"].includes(status))
            return false;
        const scheduled = data.scheduledCheckOutAt?.toDate?.();
        if (!scheduled)
            return false;
        return scheduled.getTime() <= now.getTime();
    });
    for (const docSnap of due) {
        try {
            await finalizeCheckout({
                bookingId: docSnap.id,
                actorId: "system:auto-checkout",
                method: "AUTO",
                note: "Auto checkout by scheduler",
            });
        }
        catch (error) {
            logger.error("Auto checkout failed", { bookingId: docSnap.id, error });
        }
    }
});
exports.getInvoiceDownloadUrl = (0, https_1.onCall)(async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Please login first.");
    }
    const uid = request.auth.uid;
    const invoiceId = String(request.data?.invoiceId || "");
    if (!invoiceId) {
        throw new https_1.HttpsError("invalid-argument", "invoiceId is required.");
    }
    const [invoiceSnap, userSnap] = await Promise.all([
        db.collection("invoices").doc(invoiceId).get(),
        db.collection("users").doc(uid).get(),
    ]);
    if (!invoiceSnap.exists) {
        throw new https_1.HttpsError("not-found", "Invoice not found.");
    }
    const invoice = invoiceSnap.data() || {};
    const isAdminUser = String(userSnap.data()?.role || "") === "admin";
    const isOwner = String(invoice.userId || "") === uid;
    if (!isAdminUser && !isOwner) {
        throw new https_1.HttpsError("permission-denied", "Not allowed to access this invoice.");
    }
    const pdfPath = String(invoice.invoicePdfPath || "");
    if (!pdfPath) {
        throw new https_1.HttpsError("failed-precondition", "Invoice PDF is not ready.");
    }
    const bucket = admin.storage().bucket();
    const file = bucket.file(pdfPath);
    const [exists] = await file.exists();
    if (!exists) {
        throw new https_1.HttpsError("not-found", "Invoice PDF file is missing.");
    }
    try {
        const [url] = await file.getSignedUrl({
            action: "read",
            expires: Date.now() + 15 * 60 * 1000,
        });
        return { ok: true, url };
    }
    catch (error) {
        logger.error("Signed URL generation failed, using token URL fallback.", {
            invoiceId,
            pdfPath,
            error,
        });
        const [metadata] = await file.getMetadata();
        let token = String(metadata.metadata?.firebaseStorageDownloadTokens || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)[0];
        if (!token) {
            token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            await file.setMetadata({
                metadata: {
                    ...(metadata.metadata || {}),
                    firebaseStorageDownloadTokens: token,
                },
            });
        }
        const encodedPath = encodeURIComponent(pdfPath);
        const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;
        return { ok: true, url, source: "token_fallback" };
    }
});
