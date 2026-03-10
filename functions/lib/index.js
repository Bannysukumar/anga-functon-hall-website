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
exports.notifyDailyRewardAvailability = exports.monthlyLeaderboardReset = exports.adminBackfillReferralCodes = exports.adminRewardsAnalytics = exports.adminAdjustWallet = exports.adminUpdateRewardsConfig = exports.scratchRewardCard = exports.spinWheelReward = exports.claimDailyReward = exports.getRewardsDashboardData = exports.processReferralOnFirstPaidBooking = exports.initializeRewardsForUser = exports.getInvoiceDownloadUrl = exports.scheduledAutoCheckoutJob = exports.resendCheckoutEmail = exports.userCheckOut = exports.adminCheckOut = exports.adminCheckIn = exports.resendBookingConfirmationEmail = exports.processInvoiceCreated = exports.verifyPaymentAndConfirmBooking = exports.createSelfAttendance = void 0;
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
function pickWeightedValue(items) {
    const normalized = items
        .map((item) => ({
        value: Number(item.value || 0),
        weight: Math.max(0, Number(item.weight || 0)),
    }))
        .filter((item) => item.weight > 0);
    if (normalized.length === 0)
        return 0;
    const total = normalized.reduce((sum, item) => sum + item.weight, 0);
    const random = Math.random() * total;
    let cursor = 0;
    for (const item of normalized) {
        cursor += item.weight;
        if (random <= cursor)
            return item.value;
    }
    return normalized[normalized.length - 1].value;
}
function randomCode(prefix, length = 8) {
    const part = Math.random().toString(36).slice(2, 2 + length).toUpperCase();
    return `${prefix}${part}`;
}
async function generateUniqueReferralCode(prefix = "ANGA") {
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const candidate = randomCode(prefix);
        const existing = await db
            .collection("referrals")
            .where("referralCode", "==", candidate)
            .limit(1)
            .get();
        if (existing.empty)
            return candidate;
    }
    return `${prefix}${Date.now().toString(36).toUpperCase()}`;
}
async function createInAppNotification(userId, title, message, type) {
    await db.collection("notifications").add({
        userId,
        title,
        message,
        type,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}
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
const DEFAULT_REWARDS_CONFIG = {
    referral: {
        enabled: true,
        maxReferralsPerDay: 20,
    },
    scratchCard: {
        rewards: [
            { value: 1, weight: 40 },
            { value: 5, weight: 25 },
            { value: 10, weight: 20 },
            { value: 20, weight: 10 },
            { value: 50, weight: 4 },
            { value: 100, weight: 1 },
        ],
    },
    dailyReward: {
        enabled: true,
        claimIntervalHours: 24,
        rewards: [
            { value: 1, weight: 50 },
            { value: 2, weight: 30 },
            { value: 5, weight: 15 },
            { value: 10, weight: 5 },
        ],
    },
    spinWheel: {
        enabled: true,
        maxSpinsPerDay: 1,
        rewards: [
            { label: "₹1", type: "money", value: 1, weight: 30 },
            { label: "₹2", type: "money", value: 2, weight: 20 },
            { label: "₹5", type: "money", value: 5, weight: 15 },
            { label: "₹10", type: "money", value: 10, weight: 10 },
            { label: "₹20", type: "money", value: 20, weight: 5 },
            { label: "Better luck next time", type: "none", value: 0, weight: 15 },
            { label: "Extra scratch card", type: "scratch_card", value: 0, weight: 5 },
        ],
    },
};
async function getRewardsConfig() {
    const snap = await db.collection("settings").doc("rewards").get();
    const data = (snap.data() || {});
    return {
        referral: {
            ...DEFAULT_REWARDS_CONFIG.referral,
            ...(data.referral || {}),
        },
        scratchCard: {
            rewards: Array.isArray(data.scratchCard?.rewards)
                ? data.scratchCard.rewards
                : DEFAULT_REWARDS_CONFIG.scratchCard.rewards,
        },
        dailyReward: {
            ...DEFAULT_REWARDS_CONFIG.dailyReward,
            ...(data.dailyReward || {}),
            rewards: Array.isArray(data.dailyReward?.rewards)
                ? data.dailyReward.rewards
                : DEFAULT_REWARDS_CONFIG.dailyReward.rewards,
        },
        spinWheel: {
            ...DEFAULT_REWARDS_CONFIG.spinWheel,
            ...(data.spinWheel || {}),
            rewards: Array.isArray(data.spinWheel?.rewards)
                ? data.spinWheel.rewards
                : DEFAULT_REWARDS_CONFIG.spinWheel.rewards,
        },
    };
}
async function getActiveCampaignEffects() {
    const nowMs = Date.now();
    const campaignsSnap = await db.collection("campaigns").where("isActive", "==", true).get();
    const active = campaignsSnap.docs.map((d) => d.data() || {}).filter((campaign) => {
        const start = Number(campaign.startDate?.toMillis?.() || 0);
        const end = Number(campaign.endDate?.toMillis?.() || 0);
        return (!start || start <= nowMs) && (!end || end >= nowMs);
    });
    return {
        doubleReferralRewards: active.some((c) => Boolean(c.doubleReferralRewards)),
        extraScratchCards: active.reduce((sum, c) => sum + Math.max(0, Number(c.extraScratchCards || 0)), 0),
    };
}
async function createWalletTransactionInTxn(transaction, params) {
    const walletRef = db.collection("userWallets").doc(params.userId);
    const walletSnap = await transaction.get(walletRef);
    const currentBalance = Number(walletSnap.data()?.balance || 0);
    const nextBalance = params.type === "credit"
        ? currentBalance + params.amount
        : currentBalance - params.amount;
    if (nextBalance < 0) {
        throw new https_1.HttpsError("failed-precondition", "Insufficient wallet balance.");
    }
    transaction.set(walletRef, {
        userId: params.userId,
        balance: nextBalance,
        totalEarned: Number(walletSnap.data()?.totalEarned || 0) +
            (params.type === "credit" ? params.amount : 0),
        totalSpent: Number(walletSnap.data()?.totalSpent || 0) +
            (params.type === "debit" ? params.amount : 0),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: walletSnap.data()?.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    const txRef = db.collection("walletTransactions").doc();
    transaction.set(txRef, {
        userId: params.userId,
        amount: params.amount,
        type: params.type,
        source: params.source,
        description: params.description,
        referenceId: params.referenceId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: params.createdBy,
    });
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
function parseTimeHHmm(value) {
    if (typeof value === "string" && /^\d{1,2}:\d{2}$/.test(value.trim()))
        return value.trim();
    return "";
}
function buildCheckInOutSchedule(listingType, checkInDate, checkOutDate, listingTimes) {
    const checkInTime = parseTimeHHmm(listingTimes?.defaultCheckInTime) || "12:00";
    const checkOutTime = parseTimeHHmm(listingTimes?.defaultCheckOutTime) || "11:00";
    const start = new Date(`${checkInDate}T${checkInTime}`);
    const end = new Date(`${checkInDate}T${checkOutTime}`);
    if (isSlotBased(listingType)) {
        const slotStart = new Date(`${checkInDate}T${parseTimeHHmm(listingTimes?.defaultCheckInTime) || "09:00"}`);
        const slotEnd = new Date(`${checkInDate}T${parseTimeHHmm(listingTimes?.defaultCheckOutTime) || "23:59"}`);
        return {
            scheduledCheckInAt: admin.firestore.Timestamp.fromDate(slotStart),
            scheduledCheckOutAt: admin.firestore.Timestamp.fromDate(slotEnd),
        };
    }
    if (checkOutDate) {
        const parsed = new Date(`${checkOutDate}T${checkOutTime}`);
        if (!Number.isNaN(parsed.getTime()) && parsed > start) {
            return {
                scheduledCheckInAt: admin.firestore.Timestamp.fromDate(start),
                scheduledCheckOutAt: admin.firestore.Timestamp.fromDate(parsed),
            };
        }
    }
    end.setDate(end.getDate() + 1);
    return {
        scheduledCheckInAt: admin.firestore.Timestamp.fromDate(start),
        scheduledCheckOutAt: admin.firestore.Timestamp.fromDate(end),
    };
}
function getStayDateKeys(checkInDate, checkOutDate) {
    const checkIn = new Date(`${checkInDate}T00:00:00`);
    if (Number.isNaN(checkIn.getTime()))
        return [toDateKey(checkInDate)];
    const checkoutCandidate = checkOutDate ? new Date(`${checkOutDate}T00:00:00`) : null;
    const checkOut = checkoutCandidate && !Number.isNaN(checkoutCandidate.getTime()) && checkoutCandidate > checkIn
        ? checkoutCandidate
        : new Date(checkIn.getTime() + 24 * 60 * 60 * 1000);
    const keys = [];
    for (let cursor = new Date(checkIn); cursor < checkOut; cursor.setDate(cursor.getDate() + 1)) {
        const yyyy = cursor.getFullYear();
        const mm = String(cursor.getMonth() + 1).padStart(2, "0");
        const dd = String(cursor.getDate()).padStart(2, "0");
        keys.push(`${yyyy}${mm}${dd}`);
    }
    return keys.length ? keys : [toDateKey(checkInDate)];
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
    const defaultSubject = "Your Booking Confirmation - Anga Function Hall";
    const defaultBody = `
    <p>Hello {userName},</p>
    <p>Your booking at Anga Function Hall is confirmed.</p>
    <p><strong>Booking ID:</strong> {bookingId}</p>
    <p><strong>Event Date:</strong> {dates}</p>
    <p><strong>Hall/Room:</strong> {listingName}</p>
    <p><strong>Booking Amount:</strong> INR {bookingAmount}</p>
    <p><strong>Status:</strong> {bookingStatus}</p>
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
        bookingAmount: Number(bookingData.totalAmount || invoiceData.breakdown?.totalAmount || 0).toFixed(2),
        bookingStatus: String(bookingData.status || "confirmed"),
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
    const defaultSubject = "Thank You for Choosing Anga Function Hall";
    const defaultBody = "<p>Hello {userName},</p><p>Your event is completed successfully.</p><p><strong>Booking ID:</strong> {bookingId}</p><p><strong>Event Date:</strong> {eventDate}</p><p><strong>Checkout Date:</strong> {checkOutAt}</p><p><strong>Total Amount Paid:</strong> INR {paidAmount}</p><p>Thank you for choosing Anga Function Hall.</p>";
    const templateValues = {
        userName: String(invoiceData.customer?.name || "Guest"),
        bookingId: String(bookingData.id || ""),
        invoiceNumber: String(bookingData.invoiceNumber || invoiceData.invoiceNumber || ""),
        listingName: String(bookingData.listingTitle || ""),
        allocation: String((bookingData.allocatedResource?.labels || []).join(", ")),
        eventDate: String(invoiceData.service?.dateKey || ""),
        paidAmount: Number(invoiceData.breakdown?.paidAmount || bookingData.advancePaid || 0).toFixed(2),
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
async function sendRewardEmail(params) {
    const [userSnap, runtimeConfig] = await Promise.all([
        db.collection("users").doc(params.userId).get(),
        getRuntimeSecureConfig(),
    ]);
    const toEmail = String(userSnap.data()?.email || "");
    if (!toEmail)
        return;
    const smtpTransport = await getSmtpTransportFromConfig(runtimeConfig);
    if (!smtpTransport)
        return;
    const from = `"${runtimeConfig.smtpFromName || "Anga Function Hall"}" <${runtimeConfig.smtpFromEmail || runtimeConfig.smtpUser}>`;
    try {
        await smtpTransport.sendMail({
            from,
            to: toEmail,
            subject: params.subject,
            html: params.html,
        });
    }
    catch (error) {
        logger.error("Reward email failed", { userId: params.userId, error });
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
    if (!payload?.intentId) {
        throw new https_1.HttpsError("invalid-argument", "intentId is required.");
    }
    const walletOnly = Boolean(payload.walletOnly);
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
    if (!walletOnly) {
        if (!payload?.razorpayOrderId ||
            !payload?.razorpayPaymentId ||
            !payload?.razorpaySignature) {
            throw new https_1.HttpsError("invalid-argument", "Missing payment verification fields.");
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
            if (!walletOnly && String(intent.razorpayOrderId || "") !== String(payload.razorpayOrderId || "")) {
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
            const minGuestCount = Math.max(1, Number(listing.minGuestCount || 1));
            const guestCount = Math.max(1, Number(intent.guestCount || 1));
            if (guestCount < minGuestCount) {
                throw new https_1.HttpsError("failed-precondition", `Minimum ${minGuestCount} guest(s) required for this listing.`);
            }
            const unitsBooked = Math.max(1, Number(intent.unitsBooked || 1));
            const checkInDate = String(intent.checkInDate || "");
            const checkOutDate = intent.checkOutDate ? String(intent.checkOutDate) : null;
            const dateKey = toDateKey(checkInDate);
            const lockDate = checkInDate;
            const stayDateKeys = isSlotBased(String(listing.type || "function_hall"))
                ? [dateKey]
                : getStayDateKeys(checkInDate, checkOutDate);
            const schedule = buildCheckInOutSchedule(String(listing.type || "function_hall"), checkInDate, checkOutDate, {
                defaultCheckInTime: listing.defaultCheckInTime,
                defaultCheckOutTime: listing.defaultCheckOutTime,
            });
            const bookingRef = db.collection("bookings").doc();
            const paymentRef = db.collection("payments").doc();
            const invoiceRef = db.collection("invoices").doc();
            const counterRef = db.collection("counters").doc("invoices");
            const now = admin.firestore.FieldValue.serverTimestamp();
            const counterSnap = await transaction.get(counterRef);
            const currentCounter = Number(counterSnap.data()?.value || 0) + 1;
            const invoiceNumber = nextInvoiceNumber(currentCounter);
            let allocation = null;
            for (const key of stayDateKeys) {
                const year = key.slice(0, 4);
                const month = key.slice(4, 6);
                const day = key.slice(6, 8);
                const allocationForDay = await allocateResourcesInTransaction(transaction, {
                    bookingRef,
                    listingRef,
                    listing,
                    dateKey: key,
                    lockDate: `${year}-${month}-${day}`,
                    slotId: intent.slotId || null,
                    unitsBooked,
                    userId: uid,
                });
                if (!allocation) {
                    allocation = allocationForDay;
                }
            }
            if (!allocation) {
                throw new https_1.HttpsError("failed-precondition", "Could not allocate resources.");
            }
            transaction.set(counterRef, { value: currentCounter }, { merge: true });
            const pricing = intent.pricing || {};
            const paymentStatus = Number(pricing.dueAmount || 0) > 0 ? "advance_paid" : "fully_paid";
            const walletApplied = Math.max(0, Number(pricing.walletApplied || 0));
            const cashbackAmount = Math.max(0, Number(pricing.cashbackAmount || 0));
            if (walletApplied > 0) {
                await createWalletTransactionInTxn(transaction, {
                    userId: uid,
                    amount: walletApplied,
                    type: "debit",
                    source: "booking_payment",
                    description: `Wallet used for booking ${bookingRef.id}`,
                    referenceId: bookingRef.id,
                    createdBy: uid,
                });
            }
            if (cashbackAmount > 0) {
                await createWalletTransactionInTxn(transaction, {
                    userId: uid,
                    amount: cashbackAmount,
                    type: "credit",
                    source: "cashback",
                    description: `Coupon cashback for booking ${bookingRef.id}`,
                    referenceId: bookingRef.id,
                    createdBy: "system:coupon",
                });
            }
            transaction.set(paymentRef, {
                bookingId: bookingRef.id,
                userId: uid,
                listingId: intent.listingId,
                branchId: intent.branchId,
                amount: Number(pricing.amountToPay || 0),
                walletAmount: walletApplied,
                totalAmount: Number(pricing.totalAmount || 0),
                currency: "INR",
                status: "captured",
                gateway: walletOnly ? "wallet" : "razorpay",
                verified: true,
                razorpayOrderId: walletOnly ? "" : String(payload.razorpayOrderId || ""),
                razorpayPaymentId: walletOnly ? "" : String(payload.razorpayPaymentId || ""),
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
                    paidAmount: Number(pricing.amountToPay || 0) + walletApplied,
                    dueAmount: Number(pricing.dueAmount || 0),
                },
                payment: {
                    razorpayOrderId: walletOnly ? "" : String(payload.razorpayOrderId || ""),
                    razorpayPaymentId: walletOnly ? "" : String(payload.razorpayPaymentId || ""),
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
                checkInDate: admin.firestore.Timestamp.fromDate(new Date(checkInDate)),
                checkOutDate: checkOutDate
                    ? admin.firestore.Timestamp.fromDate(new Date(checkOutDate))
                    : null,
                slotId: intent.slotId || null,
                slotName: intent.slotName || null,
                guestCount,
                unitsBooked,
                selectedAddons: intent.selectedAddons || [],
                basePrice: Number(pricing.basePrice || 0),
                addonsTotal: Number(pricing.addonsTotal || 0),
                couponDiscount: Number(pricing.couponDiscount || 0),
                taxAmount: Number(pricing.taxAmount || 0),
                serviceFee: Number(pricing.serviceFee || 0),
                totalAmount: Number(pricing.totalAmount || 0),
                advancePaid: Number(pricing.amountToPay || 0),
                walletSpent: walletApplied,
                dueAmount: Number(pricing.dueAmount || 0),
                cashbackAmount,
                status: "confirmed",
                paymentStatus,
                paymentVerified: true,
                razorpayOrderId: walletOnly ? "" : String(payload.razorpayOrderId || ""),
                razorpayPaymentId: walletOnly ? "" : String(payload.razorpayPaymentId || ""),
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
        if (status !== "checked_in")
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
exports.initializeRewardsForUser = (0, firestore_1.onDocumentCreated)("users/{userId}", async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const userId = event.params.userId;
    const user = snap.data() || {};
    const referralCode = await generateUniqueReferralCode("ANGA");
    const referredByCode = String(user.referredByCode || "").trim().toUpperCase();
    let notifyReferrerId = "";
    await db.runTransaction(async (transaction) => {
        const referralRef = db.collection("referrals").doc(userId);
        const walletRef = db.collection("userWallets").doc(userId);
        const referralSnap = await transaction.get(referralRef);
        const walletSnap = await transaction.get(walletRef);
        if (!referralSnap.exists) {
            transaction.set(referralRef, {
                userId,
                referralCode,
                referredByCode: referredByCode || null,
                referredByUserId: null,
                pendingReferrals: 0,
                successfulReferrals: 0,
                totalReferrals: 0,
                rewardEarned: 0,
                lifetimeSuccessfulReferrals: 0,
                lifetimeTotalReferrals: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        if (referredByCode) {
            const referrerQuerySnap = await transaction.get(db.collection("referrals").where("referralCode", "==", referredByCode).limit(1));
            if (!referrerQuerySnap.empty) {
                const referrerDoc = referrerQuerySnap.docs[0];
                if (referrerDoc.id !== userId) {
                    notifyReferrerId = referrerDoc.id;
                    transaction.set(referrerDoc.ref, {
                        totalReferrals: Number(referrerDoc.data()?.totalReferrals || 0) + 1,
                        lifetimeTotalReferrals: Number(referrerDoc.data()?.lifetimeTotalReferrals || 0) + 1,
                        pendingReferrals: Number(referrerDoc.data()?.pendingReferrals || 0) + 1,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    }, { merge: true });
                    transaction.set(referralRef, {
                        referredByUserId: referrerDoc.id,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    }, { merge: true });
                }
            }
        }
        transaction.set(walletRef, {
            userId,
            balance: Number(walletSnap.data()?.balance || 0),
            totalEarned: Number(walletSnap.data()?.totalEarned || 0),
            totalSpent: Number(walletSnap.data()?.totalSpent || 0),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    });
    if (notifyReferrerId) {
        await createInAppNotification(notifyReferrerId, "New referral signup", "A new user has signed up using your referral code.", "referral_signup");
        await sendRewardEmail({
            userId: notifyReferrerId,
            subject: "New referral signup",
            html: "<p>Someone signed up using your referral code. Reward unlocks after their first paid booking.</p>",
        });
    }
});
exports.processReferralOnFirstPaidBooking = (0, firestore_1.onDocumentCreated)("bookings/{bookingId}", async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const bookingId = event.params.bookingId;
    const booking = snap.data() || {};
    const userId = String(booking.userId || "");
    if (!userId)
        return;
    if (!["confirmed", "checked_in", "checked_out", "completed"].includes(String(booking.status || "")))
        return;
    const rewardsConfig = await getRewardsConfig();
    const campaign = await getActiveCampaignEffects();
    if (!rewardsConfig.referral.enabled)
        return;
    const userBookingsSnap = await db
        .collection("bookings")
        .where("userId", "==", userId)
        .where("status", "in", ["confirmed", "checked_in", "checked_out", "completed"])
        .limit(2)
        .get();
    if (userBookingsSnap.size > 1)
        return;
    const referredUserReferralRef = db.collection("referrals").doc(userId);
    let rewardedReferrerId = "";
    await db.runTransaction(async (transaction) => {
        const referredSnap = await transaction.get(referredUserReferralRef);
        if (!referredSnap.exists)
            return;
        const referred = referredSnap.data() || {};
        if (referred.firstPaidBookingId)
            return;
        const referredByCode = String(referred.referredByCode || "");
        if (!referredByCode)
            return;
        const referrerSnap = await transaction.get(db.collection("referrals").where("referralCode", "==", referredByCode).limit(1));
        if (referrerSnap.empty)
            return;
        const referrerDoc = referrerSnap.docs[0];
        const referrerId = referrerDoc.id;
        rewardedReferrerId = referrerId;
        if (referrerId === userId)
            return;
        const [referrerUserSnap, referredUserSnap] = await Promise.all([
            transaction.get(db.collection("users").doc(referrerId)),
            transaction.get(db.collection("users").doc(userId)),
        ]);
        const referrerDeviceId = String(referrerUserSnap.data()?.deviceId || "");
        const referredDeviceId = String(referredUserSnap.data()?.deviceId || "");
        if (referrerDeviceId && referredDeviceId && referrerDeviceId === referredDeviceId) {
            return;
        }
        const todayKey = new Date().toISOString().slice(0, 10);
        const dailyCountRef = db.collection("referralDailyStats").doc(`${referrerId}_${todayKey}`);
        const dailyCountSnap = await transaction.get(dailyCountRef);
        const currentDaily = Number(dailyCountSnap.data()?.count || 0);
        if (currentDaily >= Math.max(1, rewardsConfig.referral.maxReferralsPerDay))
            return;
        transaction.set(referredUserReferralRef, {
            referredByUserId: referrerId,
            firstPaidBookingId: bookingId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.set(referrerDoc.ref, {
            totalReferrals: Number(referrerDoc.data()?.totalReferrals || 0) + 1,
            successfulReferrals: Number(referrerDoc.data()?.successfulReferrals || 0) + 1,
            lifetimeSuccessfulReferrals: Number(referrerDoc.data()?.lifetimeSuccessfulReferrals || 0) + 1,
            pendingReferrals: Math.max(0, Number(referrerDoc.data()?.pendingReferrals || 0) - 1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.set(dailyCountRef, {
            referrerId,
            day: todayKey,
            count: currentDaily + 1,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        const cardsToCreate = 1 + (campaign.doubleReferralRewards ? 1 : 0) + campaign.extraScratchCards;
        for (let index = 0; index < cardsToCreate; index += 1) {
            const cardRef = db.collection("scratchCards").doc();
            transaction.set(cardRef, {
                userId: referrerId,
                referralBookingId: bookingId,
                status: "available",
                rewardAmount: null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    });
    if (rewardedReferrerId) {
        await createInAppNotification(rewardedReferrerId, "Referral successful", "A referred user completed first paid booking. Scratch card unlocked.", "referral_success");
        await sendRewardEmail({
            userId: rewardedReferrerId,
            subject: "Referral successful - scratch card unlocked",
            html: "<p>Your referral has completed first paid booking. A scratch card is now available in your dashboard.</p>",
        });
    }
});
exports.getRewardsDashboardData = (0, https_1.onCall)({ cors: true }, async (request) => {
    if (!request.auth?.uid)
        throw new https_1.HttpsError("unauthenticated", "Please login first.");
    const uid = request.auth.uid;
    const [walletSnap, referralSnap, txSnap, cardsSnap, rewardsConfig, usersSnap, lbSnap, dailySnap, spinSnap] = await Promise.all([
        db.collection("userWallets").doc(uid).get(),
        db.collection("referrals").doc(uid).get(),
        db.collection("walletTransactions").where("userId", "==", uid).limit(20).get(),
        db.collection("scratchCards").where("userId", "==", uid).limit(30).get(),
        getRewardsConfig(),
        db.collection("users").get(),
        db.collection("referrals").orderBy("successfulReferrals", "desc").limit(10).get(),
        db.collection("dailyRewards").doc(uid).get(),
        db.collection("spinUsage").doc(`${uid}_${new Date().toISOString().slice(0, 10)}`).get(),
    ]);
    const referralCode = String(referralSnap.data()?.referralCode || "");
    const appBaseUrl = (await getRuntimeSecureConfig()).appBaseUrl || "https://angafunctionhall.com";
    const userMap = new Map(usersSnap.docs.map((d) => [d.id, d.data()]));
    const nextClaimAtTs = dailySnap.data()?.lastClaimAt?.toMillis?.()
        ? Number(dailySnap.data()?.lastClaimAt.toMillis()) +
            rewardsConfig.dailyReward.claimIntervalHours * 60 * 60 * 1000
        : null;
    return {
        wallet: {
            balance: Number(walletSnap.data()?.balance || 0),
            totalEarned: Number(walletSnap.data()?.totalEarned || 0),
            totalSpent: Number(walletSnap.data()?.totalSpent || 0),
        },
        referral: {
            referralCode,
            referralLink: `${appBaseUrl}/signup?ref=${encodeURIComponent(referralCode)}`,
            totalReferrals: Number(referralSnap.data()?.totalReferrals || 0),
            pendingReferrals: Number(referralSnap.data()?.pendingReferrals || 0),
            successfulReferrals: Number(referralSnap.data()?.successfulReferrals || 0),
            rewardEarned: Number(referralSnap.data()?.rewardEarned || 0),
        },
        scratchCards: cardsSnap.docs.map((docSnap) => {
            const data = docSnap.data() || {};
            return {
                id: docSnap.id,
                status: String(data.status || "locked"),
                rewardAmount: data.rewardAmount === null ? null : Number(data.rewardAmount || 0),
                createdAt: Number(data.createdAt?.toMillis?.() || 0),
            };
        }),
        recentTransactions: txSnap.docs.map((docSnap) => {
            const data = docSnap.data() || {};
            return {
                id: docSnap.id,
                amount: Number(data.amount || 0),
                type: String(data.type || "credit"),
                source: String(data.source || ""),
                description: String(data.description || ""),
                createdAt: Number(data.createdAt?.toMillis?.() || 0),
            };
        }),
        dailyReward: {
            enabled: rewardsConfig.dailyReward.enabled,
            claimIntervalHours: rewardsConfig.dailyReward.claimIntervalHours,
            canClaim: rewardsConfig.dailyReward.enabled &&
                (!nextClaimAtTs || Date.now() >= nextClaimAtTs),
            nextClaimAt: nextClaimAtTs,
        },
        spin: {
            enabled: rewardsConfig.spinWheel.enabled,
            spinsLeftToday: Math.max(0, rewardsConfig.spinWheel.maxSpinsPerDay - Number(spinSnap.data()?.count || 0)),
            maxSpinsPerDay: rewardsConfig.spinWheel.maxSpinsPerDay,
        },
        leaderboard: lbSnap.docs.map((docSnap, index) => {
            const data = docSnap.data() || {};
            return {
                rank: index + 1,
                userId: docSnap.id,
                displayName: String(userMap.get(docSnap.id)?.displayName || "User"),
                successfulReferrals: Number(data.successfulReferrals || 0),
                totalRewards: Number(data.rewardEarned || 0),
            };
        }),
    };
});
exports.claimDailyReward = (0, https_1.onCall)({ cors: true }, async (request) => {
    if (!request.auth?.uid)
        throw new https_1.HttpsError("unauthenticated", "Please login first.");
    const uid = request.auth.uid;
    const rewardsConfig = await getRewardsConfig();
    if (!rewardsConfig.dailyReward.enabled) {
        throw new https_1.HttpsError("failed-precondition", "Daily reward is disabled.");
    }
    const amount = pickWeightedValue(rewardsConfig.dailyReward.rewards);
    let balance = 0;
    await db.runTransaction(async (transaction) => {
        const dailyRef = db.collection("dailyRewards").doc(uid);
        const dailySnap = await transaction.get(dailyRef);
        const lastClaim = Number(dailySnap.data()?.lastClaimAt?.toMillis?.() || 0);
        const minNext = lastClaim + rewardsConfig.dailyReward.claimIntervalHours * 60 * 60 * 1000;
        if (lastClaim > 0 && Date.now() < minNext) {
            throw new https_1.HttpsError("failed-precondition", "Daily reward is not ready yet.");
        }
        await createWalletTransactionInTxn(transaction, {
            userId: uid,
            amount,
            type: "credit",
            source: "daily_login",
            description: "Daily login reward",
            referenceId: `daily_${Date.now()}`,
            createdBy: uid,
        });
        const walletSnap = await transaction.get(db.collection("userWallets").doc(uid));
        balance = Number(walletSnap.data()?.balance || 0) + amount;
        transaction.set(dailyRef, {
            userId: uid,
            lastClaimAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    });
    await createInAppNotification(uid, "Daily reward claimed", `₹${amount} added to your wallet.`, "daily_reward");
    await sendRewardEmail({
        userId: uid,
        subject: "Daily reward credited",
        html: `<p>Your daily reward of INR ${amount} has been credited to your wallet.</p>`,
    });
    return { ok: true, amount, balance };
});
exports.spinWheelReward = (0, https_1.onCall)({ cors: true }, async (request) => {
    if (!request.auth?.uid)
        throw new https_1.HttpsError("unauthenticated", "Please login first.");
    const uid = request.auth.uid;
    const rewardsConfig = await getRewardsConfig();
    if (!rewardsConfig.spinWheel.enabled) {
        throw new https_1.HttpsError("failed-precondition", "Spin wheel is disabled.");
    }
    const dayKey = new Date().toISOString().slice(0, 10);
    const usageRef = db.collection("spinUsage").doc(`${uid}_${dayKey}`);
    const roll = pickWeightedValue(rewardsConfig.spinWheel.rewards.map((item, index) => ({ value: index + 1, weight: item.weight }))) - 1;
    const selected = rewardsConfig.spinWheel.rewards[Math.max(0, roll)] || {
        label: "Better luck next time",
        type: "none",
        value: 0,
        weight: 100,
    };
    let balance = 0;
    await db.runTransaction(async (transaction) => {
        const usageSnap = await transaction.get(usageRef);
        const count = Number(usageSnap.data()?.count || 0);
        if (count >= rewardsConfig.spinWheel.maxSpinsPerDay) {
            throw new https_1.HttpsError("failed-precondition", "No spins left for today.");
        }
        transaction.set(usageRef, {
            userId: uid,
            day: dayKey,
            count: count + 1,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        if (selected.type === "money" && Number(selected.value || 0) > 0) {
            await createWalletTransactionInTxn(transaction, {
                userId: uid,
                amount: Number(selected.value || 0),
                type: "credit",
                source: "spin_wheel",
                description: `Spin reward: ${selected.label}`,
                referenceId: `spin_${dayKey}`,
                createdBy: uid,
            });
            const walletSnap = await transaction.get(db.collection("userWallets").doc(uid));
            balance = Number(walletSnap.data()?.balance || 0) + Number(selected.value || 0);
        }
        else if (selected.type === "scratch_card") {
            transaction.set(db.collection("scratchCards").doc(), {
                userId: uid,
                status: "available",
                rewardAmount: null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                source: "spin",
            });
            const walletSnap = await transaction.get(db.collection("userWallets").doc(uid));
            balance = Number(walletSnap.data()?.balance || 0);
        }
        else {
            const walletSnap = await transaction.get(db.collection("userWallets").doc(uid));
            balance = Number(walletSnap.data()?.balance || 0);
        }
    });
    await createInAppNotification(uid, "Spin result", selected.label, "spin");
    await sendRewardEmail({
        userId: uid,
        subject: "Spin reward update",
        html: `<p>Your Spin & Win result: <strong>${selected.label}</strong>.</p>`,
    });
    return {
        ok: true,
        rewardType: selected.type,
        label: selected.label,
        amount: Number(selected.value || 0),
        balance,
    };
});
exports.scratchRewardCard = (0, https_1.onCall)({ cors: true }, async (request) => {
    if (!request.auth?.uid)
        throw new https_1.HttpsError("unauthenticated", "Please login first.");
    const uid = request.auth.uid;
    const cardId = String(request.data?.cardId || "");
    if (!cardId)
        throw new https_1.HttpsError("invalid-argument", "cardId is required.");
    const rewardsConfig = await getRewardsConfig();
    const amount = pickWeightedValue(rewardsConfig.scratchCard.rewards);
    let balance = 0;
    await db.runTransaction(async (transaction) => {
        const cardRef = db.collection("scratchCards").doc(cardId);
        const cardSnap = await transaction.get(cardRef);
        if (!cardSnap.exists)
            throw new https_1.HttpsError("not-found", "Scratch card not found.");
        const card = cardSnap.data() || {};
        if (String(card.userId || "") !== uid)
            throw new https_1.HttpsError("permission-denied", "Not allowed.");
        if (String(card.status || "") === "scratched") {
            throw new https_1.HttpsError("already-exists", "Scratch card already used.");
        }
        transaction.set(cardRef, {
            status: "scratched",
            rewardAmount: amount,
            scratchedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        await createWalletTransactionInTxn(transaction, {
            userId: uid,
            amount,
            type: "credit",
            source: "scratch_card",
            description: "Scratch card reward",
            referenceId: cardId,
            createdBy: uid,
        });
        const walletSnap = await transaction.get(db.collection("userWallets").doc(uid));
        balance = Number(walletSnap.data()?.balance || 0) + amount;
    });
    await createInAppNotification(uid, "Scratch card unlocked", `₹${amount} added to your wallet.`, "scratch");
    await sendRewardEmail({
        userId: uid,
        subject: "Scratch card reward credited",
        html: `<p>You scratched a card and won INR ${amount}. The amount was added to your wallet.</p>`,
    });
    return { ok: true, amount, balance };
});
exports.adminUpdateRewardsConfig = (0, https_1.onCall)({ cors: true }, async (request) => {
    if (!request.auth?.uid)
        throw new https_1.HttpsError("unauthenticated", "Please login first.");
    const adminUser = await db.collection("users").doc(request.auth.uid).get();
    if (String(adminUser.data()?.role || "") !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Only admin can update rewards config.");
    }
    const payload = (request.data?.payload || {});
    await db.collection("settings").doc("rewards").set(payload, { merge: true });
    return { ok: true };
});
exports.adminAdjustWallet = (0, https_1.onCall)({ cors: true }, async (request) => {
    if (!request.auth?.uid)
        throw new https_1.HttpsError("unauthenticated", "Please login first.");
    const adminUser = await db.collection("users").doc(request.auth.uid).get();
    if (String(adminUser.data()?.role || "") !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Only admin can adjust wallet.");
    }
    const targetUserId = String(request.data?.targetUserId || "");
    const amount = Number(request.data?.amount || 0);
    const reason = String(request.data?.reason || "").trim();
    if (!targetUserId || !Number.isFinite(amount) || amount === 0 || !reason) {
        throw new https_1.HttpsError("invalid-argument", "targetUserId, amount and reason are required.");
    }
    await db.runTransaction(async (transaction) => {
        await createWalletTransactionInTxn(transaction, {
            userId: targetUserId,
            amount: Math.abs(amount),
            type: amount > 0 ? "credit" : "debit",
            source: "admin_adjustment",
            description: reason,
            referenceId: `admin_${Date.now()}`,
            createdBy: request.auth.uid,
        });
    });
    await createInAppNotification(targetUserId, "Wallet updated", reason, "wallet_adjustment");
    return { ok: true };
});
exports.adminRewardsAnalytics = (0, https_1.onCall)({ cors: true }, async (request) => {
    if (!request.auth?.uid)
        throw new https_1.HttpsError("unauthenticated", "Please login first.");
    const adminUser = await db.collection("users").doc(request.auth.uid).get();
    if (String(adminUser.data()?.role || "") !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Only admin can view rewards analytics.");
    }
    const [usersSnap, bookingsSnap, walletTxSnap, referralsSnap, dailySnap, spinSnap] = await Promise.all([
        db.collection("users").get(),
        db.collection("bookings").get(),
        db.collection("walletTransactions").get(),
        db.collection("referrals").get(),
        db.collection("dailyRewards").get(),
        db.collection("spinUsage").get(),
    ]);
    const totalReferralRewards = referralsSnap.docs.reduce((sum, docSnap) => sum + Number(docSnap.data()?.rewardEarned || 0), 0);
    const usersMap = new Map(usersSnap.docs.map((d) => [d.id, d.data()]));
    const topReferrers = referralsSnap.docs
        .map((docSnap) => ({
        userId: docSnap.id,
        successfulReferrals: Number(docSnap.data()?.successfulReferrals || 0),
    }))
        .sort((a, b) => b.successfulReferrals - a.successfulReferrals)
        .slice(0, 10)
        .map((item) => ({
        ...item,
        displayName: String(usersMap.get(item.userId)?.displayName || "User"),
    }));
    return {
        ok: true,
        totalUsers: usersSnap.size,
        totalBookings: bookingsSnap.size,
        totalReferralRewards,
        walletTransactions: walletTxSnap.size,
        dailyRewardUsage: dailySnap.size,
        spinUsage: spinSnap.size,
        topReferrers,
    };
});
exports.adminBackfillReferralCodes = (0, https_1.onCall)({ cors: true }, async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Please login first.");
    }
    const adminUser = await db.collection("users").doc(request.auth.uid).get();
    if (String(adminUser.data()?.role || "") !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Only admin can run backfill.");
    }
    const limit = Math.min(300, Math.max(1, Number(request.data?.limit || 100)));
    const startAfterUserId = String(request.data?.startAfterUserId || "").trim();
    let userQuery = db
        .collection("users")
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(limit);
    if (startAfterUserId) {
        userQuery = userQuery.startAfter(startAfterUserId);
    }
    const usersSnap = await userQuery.get();
    let processed = 0;
    let created = 0;
    let updatedMissingCode = 0;
    let walletCreated = 0;
    for (const userDoc of usersSnap.docs) {
        processed += 1;
        const userId = userDoc.id;
        const user = userDoc.data() || {};
        const referredByCode = String(user.referredByCode || "").trim().toUpperCase();
        const referralRef = db.collection("referrals").doc(userId);
        const walletRef = db.collection("userWallets").doc(userId);
        const [referralSnap, walletSnap] = await Promise.all([referralRef.get(), walletRef.get()]);
        if (!referralSnap.exists) {
            const referralCode = await generateUniqueReferralCode("ANGA");
            await referralRef.set({
                userId,
                referralCode,
                referredByCode: referredByCode || null,
                referredByUserId: null,
                pendingReferrals: 0,
                successfulReferrals: 0,
                totalReferrals: 0,
                rewardEarned: 0,
                lifetimeSuccessfulReferrals: 0,
                lifetimeTotalReferrals: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            created += 1;
        }
        else if (!String(referralSnap.data()?.referralCode || "").trim()) {
            const referralCode = await generateUniqueReferralCode("ANGA");
            await referralRef.set({
                referralCode,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            updatedMissingCode += 1;
        }
        if (!walletSnap.exists) {
            await walletRef.set({
                userId,
                balance: 0,
                totalEarned: 0,
                totalSpent: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            walletCreated += 1;
        }
    }
    const lastDoc = usersSnap.docs[usersSnap.docs.length - 1];
    return {
        ok: true,
        processed,
        created,
        updatedMissingCode,
        walletCreated,
        hasMore: usersSnap.size === limit,
        nextCursor: lastDoc ? lastDoc.id : "",
    };
});
exports.monthlyLeaderboardReset = (0, scheduler_1.onSchedule)({
    schedule: "0 1 1 * *",
    timeZone: TIMEZONE,
}, async () => {
    const rewardsSettings = (await db.collection("settings").doc("rewards").get()).data() || {};
    const bonusRewards = Array.isArray(rewardsSettings.leaderboardBonusRewards)
        ? rewardsSettings.leaderboardBonusRewards
        : [500, 300, 100];
    const monthKey = new Date().toISOString().slice(0, 7);
    const topSnap = await db
        .collection("referrals")
        .orderBy("successfulReferrals", "desc")
        .limit(Math.max(3, bonusRewards.length))
        .get();
    for (let index = 0; index < topSnap.docs.length; index += 1) {
        const docSnap = topSnap.docs[index];
        const bonus = Number(bonusRewards[index] || 0);
        const successful = Number(docSnap.data()?.successfulReferrals || 0);
        if (bonus > 0 && successful > 0) {
            await db.runTransaction(async (transaction) => {
                await createWalletTransactionInTxn(transaction, {
                    userId: docSnap.id,
                    amount: bonus,
                    type: "credit",
                    source: "leaderboard_bonus",
                    description: `Leaderboard bonus rank ${index + 1} (${monthKey})`,
                    referenceId: `${monthKey}_${index + 1}`,
                    createdBy: "system:leaderboard",
                });
                transaction.set(db.collection("leaderboardHistory").doc(`${monthKey}_${docSnap.id}`), {
                    monthKey,
                    userId: docSnap.id,
                    rank: index + 1,
                    bonus,
                    successfulReferrals: successful,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            });
            await createInAppNotification(docSnap.id, "Leaderboard bonus credited", `You received INR ${bonus} for rank ${index + 1} in referral leaderboard.`, "leaderboard_bonus");
            await sendRewardEmail({
                userId: docSnap.id,
                subject: "Leaderboard bonus credited",
                html: `<p>Congratulations! You earned INR ${bonus} leaderboard bonus for rank ${index + 1}.</p>`,
            });
        }
    }
    const allReferrals = await db.collection("referrals").get();
    const resetBatch = db.batch();
    allReferrals.docs.forEach((docSnap) => {
        resetBatch.set(docSnap.ref, {
            successfulReferrals: 0,
            rewardEarned: 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    });
    await resetBatch.commit();
});
exports.notifyDailyRewardAvailability = (0, scheduler_1.onSchedule)("every 2 hours", async () => {
    const rewardsConfig = await getRewardsConfig();
    if (!rewardsConfig.dailyReward.enabled)
        return;
    const usersSnap = await db.collection("users").get();
    for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const dailyRef = db.collection("dailyRewards").doc(uid);
        const dailySnap = await dailyRef.get();
        const lastClaim = Number(dailySnap.data()?.lastClaimAt?.toMillis?.() || 0);
        const lastNotified = Number(dailySnap.data()?.lastAvailableNotifiedAt?.toMillis?.() || 0);
        const intervalMs = rewardsConfig.dailyReward.claimIntervalHours * 60 * 60 * 1000;
        const now = Date.now();
        const available = !lastClaim || now - lastClaim >= intervalMs;
        const shouldNotify = available && (!lastNotified || now - lastNotified >= intervalMs / 2);
        if (!shouldNotify)
            continue;
        await createInAppNotification(uid, "Daily reward available", "Your daily wallet reward is ready to claim.", "daily_reward_available");
        await dailyRef.set({
            userId: uid,
            lastAvailableNotifiedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
});
