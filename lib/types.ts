import type { Timestamp } from "firebase/firestore"

// =====================
// Branch
// =====================
export interface Branch {
  id: string
  name: string
  address: string
  city: string
  state: string
  contactNumber: string
  mapLink: string
  timings: string
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

// =====================
// Listing
// =====================
export type ListingType =
  | "function_hall"
  | "room"
  | "dormitory"
  | "dining_hall"
  | "open_function_hall"
  | "local_tour"

export interface ListingSlot {
  slotId: string
  name: string
  startTime: string
  endTime: string
  price: number
}

export interface ListingAddon {
  name: string
  type: "fixed" | "per_person" | "per_hour"
  price: number
}

export interface Listing {
  id: string
  roomId?: string
  branchId: string
  title: string
  type: ListingType
  description: string
  images: string[]
  amenities: string[]
  rules: string[]
  capacity: number
  inventory: number
  pricePerUnit: number
  originalPrice?: number
  slotsEnabled: boolean
  slots: ListingSlot[]
  paymentMode: "full" | "advance_fixed" | "advance_percent"
  advanceAmount: number
  cancellationPolicy: "free" | "partial" | "non_refundable"
  freeCancelHours: number
  partialRefundPercent: number
  addons: ListingAddon[]
  isActive: boolean
  isFeatured: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

// =====================
// Booking
// =====================
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "completed"
  | "cancelled"
  | "no_show"
export type PaymentStatus =
  | "pending"
  | "advance_paid"
  | "fully_paid"
  | "refund_requested"
  | "refunded"

export interface SelectedAddon {
  name: string
  quantity: number
  totalPrice: number
}

export interface Booking {
  id: string
  roomId?: string
  userId: string
  listingId: string
  branchId: string
  listingType: ListingType
  listingTitle: string
  branchName: string
  checkInDate: Timestamp
  checkOutDate: Timestamp | null
  slotId: string | null
  slotName: string | null
  guestCount: number
  unitsBooked: number
  selectedAddons: SelectedAddon[]
  basePrice: number
  addonsTotal: number
  couponDiscount: number
  taxAmount: number
  serviceFee: number
  totalAmount: number
  advancePaid: number
  dueAmount: number
  status: BookingStatus
  paymentStatus: PaymentStatus
  razorpayOrderId: string
  razorpayPaymentId: string
  invoiceNumber: string
  invoiceId?: string
  allocatedResource?: {
    allocationType: "units" | "inventory" | "slot" | "seats"
    unitIds?: string[]
    labels?: string[]
    reservationDocIds?: string[]
    dateKey?: string
    slotId?: string | null
    quantity: number
  }
  paymentVerified?: boolean
  emailStatus?: "pending" | "sent" | "failed"
  scheduledCheckInAt?: Timestamp | null
  scheduledCheckOutAt?: Timestamp | null
  checkInAt?: Timestamp | null
  checkOutAt?: Timestamp | null
  checkedInBy?: string | null
  checkedOutBy?: string | null
  checkoutMethod?: "USER" | "ADMIN" | "AUTO" | null
  checkoutNotes?: string
  checkoutEmailStatus?: "pending" | "sent" | "failed"
  cancelledAt: Timestamp | null
  refundAmount: number
  refundStatus: "none" | "requested" | "approved" | "processed"
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Reservation {
  id: string
  listingId: string
  bookingId: string
  userId: string
  dateKey: string
  unitId?: string
  slotId?: string | null
  quantity?: number
  status: "BOOKED"
  createdAt: Timestamp
}

export interface Invoice {
  id: string
  invoiceNumber: string
  bookingId: string
  userId: string
  issuedAt: Timestamp
  customer: {
    name: string
    email: string
    phone: string
  }
  service: {
    listingId: string
    listingTitle: string
    listingType: ListingType
    dateKey: string
    slotName?: string | null
    allocatedLabels: string[]
  }
  breakdown: {
    basePrice: number
    addonsTotal: number
    couponDiscount: number
    taxAmount: number
    serviceFee: number
    totalAmount: number
    paidAmount: number
    dueAmount: number
  }
  payment: {
    razorpayOrderId: string
    razorpayPaymentId: string
  }
  invoicePdfUrl?: string
  invoicePdfPath?: string
  invoiceHtml?: string
  emailStatus?: "pending" | "sent" | "failed"
}

// =====================
// User
// =====================
export interface AppUser {
  id: string
  email: string
  displayName: string
  phone: string
  photoURL: string
  favorites: string[]
  isBlocked: boolean
  role?: "user" | "admin"
  createdAt: Timestamp
}

// =====================
// Availability Lock
// =====================
export interface AvailabilityLock {
  id: string
  listingId: string
  date: string
  slotId: string
  bookedUnits: number
  maxUnits: number
  bookingIds: string[]
  isBlocked: boolean
  updatedAt: Timestamp
}

// =====================
// Coupon
// =====================
export interface Coupon {
  id: string
  code: string
  discountType: "flat" | "percent"
  discountValue: number
  minOrderAmount: number
  maxUses: number
  usedCount: number
  validFrom: Timestamp
  validUntil: Timestamp
  isActive: boolean
}

// =====================
// Settings
// =====================
export interface HeroBanner {
  imageUrl: string
  title: string
  subtitle: string
}

export interface SocialLink {
  platform: string
  label: string
  url: string
}

export interface SiteSettings {
  serviceFeePercent: number
  taxPercent: number
  contactEmail: string
  contactPhone: string
  siteLogoUrl: string
  refundPolicyText: string
  minAdvancePercent: number
  maxBookingWindowDays: number
  razorpayKeyId: string
  razorpayDisplayName: string
  heroBanners: HeroBanner[]
  featuredListingIds: string[]
  bookingEmailSubjectTemplate?: string
  bookingEmailHtmlTemplate?: string
  checkoutEmailSubjectTemplate?: string
  checkoutEmailHtmlTemplate?: string
  socialLinks: SocialLink[]
}

export interface SecureSettings {
  razorpaySecretKey: string
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUser: string
  smtpPass: string
  smtpFromName: string
  smtpFromEmail: string
  adminNotificationEmail: string
  appBaseUrl: string
}

// =====================
// RBAC + Attendance
// =====================
export type Permission =
  | "BOOKINGS_VIEW"
  | "BOOKINGS_UPDATE_STATUS"
  | "BOOKINGS_CREATE_MANUAL"
  | "LISTINGS_VIEW"
  | "LISTINGS_CREATE_EDIT"
  | "LISTINGS_DELETE"
  | "PAYMENTS_VIEW"
  | "REFUNDS_MANAGE"
  | "USERS_VIEW"
  | "USERS_BLOCK_UNBLOCK"
  | "STAFF_ASSIGN_ROLE"
  | "ATTENDANCE_VIEW_ALL"
  | "ATTENDANCE_MARK_FOR_OTHERS"
  | "ATTENDANCE_SELF_MARK"
  | "CMS_EDIT"
  | "SETTINGS_EDIT"

export interface Role {
  id: string
  roleName: string
  description: string
  permissions: Permission[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface StaffProfile {
  id: string
  userId: string
  name: string
  phone: string
  email: string
  roleId: string
  extraRoleIds: string[]
  effectivePermissions: Permission[]
  branchId: string
  workLocationId: string
  scheduleId: string
  active: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface WorkLocation {
  id: string
  name: string
  address: string
  geoPoint: {
    lat: number
    lng: number
  }
  radiusMeters: number
  branchId: string
  active: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface AttendanceSchedule {
  id: string
  name: string
  daysOfWeek: number[]
  startTime: string
  endTime: string
  graceMinutes: number
  branchId: string
  active: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE"
export type AttendanceMethod = "SELF" | "ADMIN"

export interface AttendanceEntry {
  id: string
  userId: string
  roleId: string
  branchId: string
  scheduleId: string
  workLocationId: string
  dateKey: string
  status: AttendanceStatus
  method: AttendanceMethod
  capturedAt: Timestamp
  geo: {
    lat: number
    lng: number
    accuracy: number
  } | null
  distanceMeters: number | null
  notes: string
  createdBy: string
  updatedAt: Timestamp
  updatedBy: string
}

export interface AuditLog {
  id: string
  entity: string
  entityId: string
  action: string
  message: string
  payload: Record<string, unknown>
  createdAt: Timestamp
  createdBy: string
}

// =====================
// Checkout State (client-side)
// =====================
export interface CheckoutState {
  listing: Listing
  branch: Branch
  checkInDate: string
  checkOutDate: string | null
  slotId: string | null
  slotName: string | null
  guestCount: number
  unitsBooked: number
  selectedAddons: SelectedAddon[]
  couponCode: string | null
  couponDiscount: number
}
