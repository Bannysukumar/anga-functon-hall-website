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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSelfAttendance = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
admin.initializeApp();
const db = admin.firestore();
const TIMEZONE = "Asia/Kolkata";
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
