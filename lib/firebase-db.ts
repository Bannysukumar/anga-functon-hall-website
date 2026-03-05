import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  runTransaction,
  type DocumentData,
  type QueryConstraint,
  Timestamp,
} from "firebase/firestore"
import { db } from "./firebase"
import type {
  Branch,
  Listing,
  Booking,
  AppUser,
  AvailabilityLock,
  Coupon,
  SiteSettings,
  SecureSettings,
  Role,
  StaffProfile,
  WorkLocation,
  AttendanceSchedule,
  AttendanceEntry,
  AuditLog,
  Invoice,
} from "./types"
import { DEFAULT_SETTINGS } from "./constants"

// =====================
// Generic helpers
// =====================
function docToType<T>(docSnap: DocumentData): T {
  return { id: docSnap.id, ...docSnap.data() } as T
}

function normalizeRoomId(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-")
}

async function ensureUniqueRoomId(roomId: string, excludeListingId?: string) {
  const normalized = normalizeRoomId(roomId)
  if (!normalized) return
  const q = query(collection(db, "listings"), where("roomId", "==", normalized))
  const snap = await getDocs(q)
  const duplicate = snap.docs.find((docSnap) => docSnap.id !== excludeListingId)
  if (duplicate) {
    throw new Error(`Room ID "${normalized}" is already used by another listing.`)
  }
}

// =====================
// Branches
// =====================
export async function getBranches(activeOnly = false): Promise<Branch[]> {
  const constraints: QueryConstraint[] = [orderBy("name", "asc")]
  const q = query(collection(db, "branches"), ...constraints)
  const snap = await getDocs(q)
  const branches = snap.docs.map((d) => docToType<Branch>(d))
  return activeOnly ? branches.filter((branch) => branch.isActive) : branches
}

export async function getBranch(id: string): Promise<Branch | null> {
  const snap = await getDoc(doc(db, "branches", id))
  return snap.exists() ? docToType<Branch>(snap) : null
}

export async function createBranch(
  data: Omit<Branch, "id" | "createdAt" | "updatedAt">
) {
  const ref = await addDoc(collection(db, "branches"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateBranch(id: string, data: Partial<Branch>) {
  await updateDoc(doc(db, "branches", id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteBranch(id: string) {
  await deleteDoc(doc(db, "branches", id))
}

// =====================
// Listings
// =====================
export async function getListings(filters?: {
  branchId?: string
  type?: string
  activeOnly?: boolean
  featuredOnly?: boolean
  limitCount?: number
}): Promise<Listing[]> {
  // Keep Firestore query simple to avoid composite-index requirements,
  // then apply filters client-side for reliability.
  const q = query(collection(db, "listings"), orderBy("createdAt", "desc"))
  const snap = await getDocs(q)
  const listings = snap.docs.map((d) => docToType<Listing>(d))

  const filtered = listings.filter((listing) => {
    if (filters?.branchId && listing.branchId !== filters.branchId) return false
    if (filters?.type && listing.type !== filters.type) return false
    if (filters?.activeOnly && !listing.isActive) return false
    if (filters?.featuredOnly && !listing.isFeatured) return false
    return true
  })

  return filters?.limitCount ? filtered.slice(0, filters.limitCount) : filtered
}

export async function getListing(id: string): Promise<Listing | null> {
  const snap = await getDoc(doc(db, "listings", id))
  return snap.exists() ? docToType<Listing>(snap) : null
}

export async function createListing(
  data: Omit<Listing, "id" | "createdAt" | "updatedAt">
) {
  const capacity = Math.max(1, Number(data.capacity || 1))
  const minGuestCount = Math.min(
    capacity,
    Math.max(1, Number(data.minGuestCount || 1))
  )
  const normalizedRoomId = normalizeRoomId(String(data.roomId || ""))
  if (data.type === "room" && !normalizedRoomId) {
    throw new Error("Room ID is required for room listings.")
  }
  if (data.type === "room" && !String(data.roomNumber || "").trim()) {
    throw new Error("Room number is required for room listings.")
  }
  if (normalizedRoomId) {
    await ensureUniqueRoomId(normalizedRoomId)
  }
  const ref = await addDoc(collection(db, "listings"), {
    ...data,
    capacity,
    minGuestCount,
    roomId: normalizedRoomId || "",
    roomNumber: String(data.roomNumber || "").trim(),
    roomTypeDetail: data.roomTypeDetail || "ac",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateListing(id: string, data: Partial<Listing>) {
  const normalizedCapacity =
    data.capacity === undefined ? undefined : Math.max(1, Number(data.capacity || 1))
  const normalizedMinGuestCount =
    data.minGuestCount === undefined
      ? undefined
      : Math.max(1, Number(data.minGuestCount || 1))
  const minGuestCount =
    normalizedMinGuestCount === undefined
      ? undefined
      : normalizedCapacity === undefined
        ? normalizedMinGuestCount
        : Math.min(normalizedCapacity, normalizedMinGuestCount)
  const normalizedRoomId = normalizeRoomId(String(data.roomId || ""))
  if (data.type === "room" && !normalizedRoomId) {
    throw new Error("Room ID is required for room listings.")
  }
  if (data.type === "room" && !String(data.roomNumber || "").trim()) {
    throw new Error("Room number is required for room listings.")
  }
  if (normalizedRoomId) {
    await ensureUniqueRoomId(normalizedRoomId, id)
  }
  await updateDoc(doc(db, "listings", id), {
    ...data,
    ...(normalizedCapacity !== undefined ? { capacity: normalizedCapacity } : {}),
    ...(minGuestCount !== undefined ? { minGuestCount } : {}),
    roomId: normalizedRoomId || "",
    roomNumber: String(data.roomNumber || "").trim(),
    roomTypeDetail: data.roomTypeDetail || "ac",
    updatedAt: serverTimestamp(),
  })
}

export async function deleteListing(id: string) {
  await deleteDoc(doc(db, "listings", id))
}

// =====================
// Bookings
// =====================
export async function getBookings(filters?: {
  userId?: string
  branchId?: string
  status?: string
  limitCount?: number
}): Promise<Booking[]> {
  const constraints: QueryConstraint[] = []
  if (filters?.userId) constraints.push(where("userId", "==", filters.userId))
  if (filters?.branchId)
    constraints.push(where("branchId", "==", filters.branchId))
  if (filters?.status) constraints.push(where("status", "==", filters.status))
  constraints.push(orderBy("createdAt", "desc"))
  if (filters?.limitCount) constraints.push(limit(filters.limitCount))
  const q = query(collection(db, "bookings"), ...constraints)
  const snap = await getDocs(q)
  return snap.docs.map((d) => docToType<Booking>(d))
}

export async function getBooking(id: string): Promise<Booking | null> {
  const snap = await getDoc(doc(db, "bookings", id))
  return snap.exists() ? docToType<Booking>(snap) : null
}

export async function createBookingWithLock(
  bookingData: Omit<Booking, "id" | "createdAt" | "updatedAt">,
  listing: Listing,
  dateStr: string,
  slotId: string
): Promise<string> {
  const lockDocId = `${listing.id}_${dateStr}_${slotId}`
  const lockRef = doc(db, "availabilityLocks", lockDocId)

  const bookingRef = doc(collection(db, "bookings"))

  await runTransaction(db, async (transaction) => {
    const lockSnap = await transaction.get(lockRef)

    let currentBooked = 0
    const maxUnits = listing.inventory || 1

    if (lockSnap.exists()) {
      const lockData = lockSnap.data()
      if (lockData.isBlocked) {
        throw new Error("This date/slot is blocked and not available for booking.")
      }
      currentBooked = lockData.bookedUnits || 0
    }

    const unitsNeeded = bookingData.unitsBooked || 1
    if (currentBooked + unitsNeeded > maxUnits) {
      throw new Error(
        `Not enough availability. Only ${maxUnits - currentBooked} unit(s) remaining.`
      )
    }

    if (lockSnap.exists()) {
      transaction.update(lockRef, {
        bookedUnits: currentBooked + unitsNeeded,
        bookingIds: [...(lockSnap.data().bookingIds || []), bookingRef.id],
        updatedAt: serverTimestamp(),
      })
    } else {
      transaction.set(lockRef, {
        listingId: listing.id,
        date: dateStr,
        slotId,
        bookedUnits: unitsNeeded,
        maxUnits,
        bookingIds: [bookingRef.id],
        isBlocked: false,
        updatedAt: serverTimestamp(),
      })
    }

    transaction.set(bookingRef, {
      ...bookingData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })

  return bookingRef.id
}

export async function updateBooking(id: string, data: Partial<Booking>) {
  await updateDoc(doc(db, "bookings", id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

// =====================
// Availability Locks
// =====================
export async function getAvailabilityLocks(
  listingId: string,
  dates?: string[],
  linkedRoomId?: string
): Promise<AvailabilityLock[]> {
  const constraints: QueryConstraint[] = [where("listingId", "==", listingId)]
  if (dates && dates.length > 0 && dates.length <= 30) {
    constraints.push(where("date", "in", dates))
  }
  const primaryQuery = getDocs(query(collection(db, "availabilityLocks"), ...constraints))
  const secondaryQuery =
    linkedRoomId && linkedRoomId !== listingId
      ? getDocs(
          query(
            collection(db, "availabilityLocks"),
            ...(dates && dates.length > 0 && dates.length <= 30
              ? [where("listingId", "==", linkedRoomId), where("date", "in", dates)]
              : [where("listingId", "==", linkedRoomId)])
          )
        )
      : Promise.resolve(null)

  const [primarySnap, secondarySnap] = await Promise.all([primaryQuery, secondaryQuery])
  const map = new Map<string, AvailabilityLock>()
  ;[...(primarySnap?.docs || []), ...(secondarySnap?.docs || [])].forEach((docSnap) => {
    const lock = docToType<AvailabilityLock>(docSnap)
    map.set(lock.id, lock)
  })
  return Array.from(map.values())
}

export async function setAvailabilityBlock(
  listingId: string,
  dateStr: string,
  slotId: string,
  isBlocked: boolean,
  maxUnits: number
) {
  const lockDocId = `${listingId}_${dateStr}_${slotId}`
  const lockRef = doc(db, "availabilityLocks", lockDocId)
  const snap = await getDoc(lockRef)

  if (snap.exists()) {
    await updateDoc(lockRef, {
      isBlocked,
      updatedAt: serverTimestamp(),
    })
  } else {
    await setDoc(lockRef, {
      listingId,
      date: dateStr,
      slotId,
      bookedUnits: 0,
      maxUnits,
      bookingIds: [],
      isBlocked,
      updatedAt: serverTimestamp(),
    })
  }
}

// =====================
// Users
// =====================
export async function getUser(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, "users", uid))
  return snap.exists() ? docToType<AppUser>(snap) : null
}

export async function updateUser(uid: string, data: Partial<AppUser>) {
  await updateDoc(doc(db, "users", uid), { ...data })
}

export async function getAllUsers(): Promise<AppUser[]> {
  const q = query(collection(db, "users"), orderBy("createdAt", "desc"))
  const snap = await getDocs(q)
  return snap.docs.map((d) => docToType<AppUser>(d))
}

// =====================
// Coupons
// =====================
export async function getCoupons(): Promise<Coupon[]> {
  const q = query(collection(db, "coupons"), orderBy("code", "asc"))
  const snap = await getDocs(q)
  return snap.docs.map((d) => docToType<Coupon>(d))
}

export async function getCouponByCode(code: string): Promise<Coupon | null> {
  const q = query(
    collection(db, "coupons"),
    where("code", "==", code.toUpperCase()),
    where("isActive", "==", true),
    limit(1)
  )
  const snap = await getDocs(q)
  return snap.docs.length > 0 ? docToType<Coupon>(snap.docs[0]) : null
}

export async function createCoupon(
  data: Omit<Coupon, "id" | "usedCount">
) {
  const ref = await addDoc(collection(db, "coupons"), {
    ...data,
    code: data.code.toUpperCase(),
    usedCount: 0,
  })
  return ref.id
}

export async function updateCoupon(id: string, data: Partial<Coupon>) {
  await updateDoc(doc(db, "coupons", id), { ...data })
}

export async function deleteCoupon(id: string) {
  await deleteDoc(doc(db, "coupons", id))
}

export async function incrementCouponUsage(couponId: string) {
  const couponRef = doc(db, "coupons", couponId)
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(couponRef)
    if (snap.exists()) {
      transaction.update(couponRef, {
        usedCount: (snap.data().usedCount || 0) + 1,
      })
    }
  })
}

// =====================
// Settings
// =====================
export async function getSettings(): Promise<SiteSettings> {
  const snap = await getDoc(doc(db, "settings", "global"))
  if (snap.exists()) {
    return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<SiteSettings>) }
  }
  return DEFAULT_SETTINGS
}

export async function updateSettings(data: Partial<SiteSettings>) {
  const settingsRef = doc(db, "settings", "global")
  await setDoc(settingsRef, { ...DEFAULT_SETTINGS, ...data }, { merge: true })
}

export async function getSecureSettings(): Promise<SecureSettings> {
  const [razorpaySnap, smtpSnap] = await Promise.all([
    getDoc(doc(db, "secureSettings", "razorpay")),
    getDoc(doc(db, "secureSettings", "smtp")),
  ])
  const razorpayData = razorpaySnap.exists()
    ? (razorpaySnap.data() as Partial<SecureSettings>)
    : {}
  const smtpData = smtpSnap.exists()
    ? (smtpSnap.data() as Partial<SecureSettings>)
    : {}

  return {
    razorpaySecretKey: razorpayData.razorpaySecretKey || "",
    smtpHost: smtpData.smtpHost || "",
    smtpPort: Number(smtpData.smtpPort || 587),
    smtpSecure: Boolean(smtpData.smtpSecure || false),
    smtpUser: smtpData.smtpUser || "",
    smtpPass: smtpData.smtpPass || "",
    smtpFromName: smtpData.smtpFromName || "",
    smtpFromEmail: smtpData.smtpFromEmail || "",
    adminNotificationEmail: smtpData.adminNotificationEmail || "",
    appBaseUrl: smtpData.appBaseUrl || "",
  }
}

export async function updateSecureSettings(data: Partial<SecureSettings>) {
  const { razorpaySecretKey, ...smtpFields } = data
  if (typeof razorpaySecretKey === "string") {
    const razorpayRef = doc(db, "secureSettings", "razorpay")
    await setDoc(razorpayRef, { razorpaySecretKey }, { merge: true })
  }

  const smtpPayload: Partial<SecureSettings> = {}
  const smtpKeys: Array<
    | "smtpHost"
    | "smtpPort"
    | "smtpSecure"
    | "smtpUser"
    | "smtpPass"
    | "smtpFromName"
    | "smtpFromEmail"
    | "adminNotificationEmail"
    | "appBaseUrl"
  > = [
    "smtpHost",
    "smtpPort",
    "smtpSecure",
    "smtpUser",
    "smtpPass",
    "smtpFromName",
    "smtpFromEmail",
    "adminNotificationEmail",
    "appBaseUrl",
  ]
  for (const key of smtpKeys) {
    if (key in smtpFields) {
      ;(smtpPayload as Record<string, unknown>)[key] = (smtpFields as Record<string, unknown>)[
        key
      ]
    }
  }
  if (Object.keys(smtpPayload).length > 0) {
    const smtpRef = doc(db, "secureSettings", "smtp")
    await setDoc(smtpRef, smtpPayload, { merge: true })
  }
}

// =====================
// Invoices
// =====================
export async function getInvoice(id: string): Promise<Invoice | null> {
  const snap = await getDoc(doc(db, "invoices", id))
  return snap.exists() ? docToType<Invoice>(snap) : null
}

export async function getUserInvoices(userId: string): Promise<Invoice[]> {
  const q = query(
    collection(db, "invoices"),
    where("userId", "==", userId),
    orderBy("issuedAt", "desc")
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => docToType<Invoice>(d))
}

// =====================
// Invoice number generator
// =====================
export function generateInvoiceNumber(): string {
  const now = new Date()
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `INV-${dateStr}-${rand}`
}

// =====================
// Roles (RBAC)
// =====================
export async function getRoles(): Promise<Role[]> {
  const q = query(collection(db, "roles"), orderBy("roleName", "asc"))
  const snap = await getDocs(q)
  return snap.docs.map((d) => docToType<Role>(d))
}

export async function createRole(
  data: Omit<Role, "id" | "createdAt" | "updatedAt">
) {
  const ref = await addDoc(collection(db, "roles"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateRole(id: string, data: Partial<Role>) {
  await updateDoc(doc(db, "roles", id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteRole(id: string) {
  await deleteDoc(doc(db, "roles", id))
}

// =====================
// Staff profiles
// =====================
export async function getStaffProfiles(): Promise<StaffProfile[]> {
  const q = query(collection(db, "staff"), orderBy("createdAt", "desc"))
  const snap = await getDocs(q)
  return snap.docs.map((d) => docToType<StaffProfile>(d))
}

export async function getStaffProfile(userId: string): Promise<StaffProfile | null> {
  const snap = await getDoc(doc(db, "staff", userId))
  return snap.exists() ? docToType<StaffProfile>(snap) : null
}

export async function upsertStaffProfile(
  userId: string,
  data: Omit<StaffProfile, "id" | "userId" | "createdAt" | "updatedAt">
) {
  await setDoc(
    doc(db, "staff", userId),
    {
      userId,
      ...data,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  )
}

// =====================
// Work locations
// =====================
export async function getWorkLocations(branchId?: string): Promise<WorkLocation[]> {
  const constraints: QueryConstraint[] = [orderBy("name", "asc")]
  if (branchId) constraints.unshift(where("branchId", "==", branchId))
  const q = query(collection(db, "workLocations"), ...constraints)
  const snap = await getDocs(q)
  return snap.docs.map((d) => docToType<WorkLocation>(d))
}

export async function createWorkLocation(
  data: Omit<WorkLocation, "id" | "createdAt" | "updatedAt">
) {
  const ref = await addDoc(collection(db, "workLocations"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateWorkLocation(id: string, data: Partial<WorkLocation>) {
  await updateDoc(doc(db, "workLocations", id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

// =====================
// Attendance schedules
// =====================
export async function getAttendanceSchedules(
  branchId?: string
): Promise<AttendanceSchedule[]> {
  const constraints: QueryConstraint[] = [orderBy("name", "asc")]
  if (branchId) constraints.unshift(where("branchId", "==", branchId))
  const q = query(collection(db, "schedules"), ...constraints)
  const snap = await getDocs(q)
  return snap.docs.map((d) => docToType<AttendanceSchedule>(d))
}

export async function createAttendanceSchedule(
  data: Omit<AttendanceSchedule, "id" | "createdAt" | "updatedAt">
) {
  const ref = await addDoc(collection(db, "schedules"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateAttendanceSchedule(
  id: string,
  data: Partial<AttendanceSchedule>
) {
  await updateDoc(doc(db, "schedules", id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

// =====================
// Attendance
// =====================
export async function getAttendanceEntries(filters?: {
  userId?: string
  branchId?: string
  scheduleId?: string
  status?: string
  dateFrom?: string
  dateTo?: string
  limitCount?: number
}): Promise<AttendanceEntry[]> {
  // Keep query simple to avoid composite index requirements in attendance screens.
  const q = query(collection(db, "attendance"))
  const snap = await getDocs(q)
  const entries = snap.docs.map((d) => docToType<AttendanceEntry>(d))
  const filtered = entries
    .filter((entry) => {
      if (filters?.userId && entry.userId !== filters.userId) return false
      if (filters?.branchId && entry.branchId !== filters.branchId) return false
      if (filters?.scheduleId && entry.scheduleId !== filters.scheduleId) return false
      if (filters?.status && entry.status !== filters.status) return false
      if (filters?.dateFrom && entry.dateKey < filters.dateFrom) return false
      if (filters?.dateTo && entry.dateKey > filters.dateTo) return false
      return true
    })
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))

  return filters?.limitCount ? filtered.slice(0, filters.limitCount) : filtered
}

export async function upsertAttendanceByAdmin(
  attendanceId: string,
  data: Omit<AttendanceEntry, "id" | "capturedAt" | "updatedAt">
) {
  await setDoc(
    doc(db, "attendance", attendanceId),
    {
      ...data,
      capturedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

// =====================
// Audit logs
// =====================
export async function createAuditLog(
  data: Omit<AuditLog, "id" | "createdAt">
) {
  await addDoc(collection(db, "auditLogs"), {
    ...data,
    createdAt: serverTimestamp(),
  })
}
