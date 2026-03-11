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
  roomNumber?: string
  roomTypeDetail?: "ac" | "non_ac"
  branchId: string
  title: string
  type: ListingType
  description: string
  images: string[]
  amenities: string[]
  rules: string[]
  capacity: number
  minGuestCount?: number
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
  /** Default check-in time for the listing (HH:mm, e.g. "09:00"). Used when creating bookings. */
  defaultCheckInTime?: string
  /** Default check-out time for the listing (HH:mm, e.g. "18:00"). Used when creating bookings. */
  defaultCheckOutTime?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

// =====================
// Booking
// =====================
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "expired"
  | "checked_in"
  | "checked_out"
  | "completed"
  | "cancelled"
  | "no_show"
export type PaymentStatus =
  | "pending"
  | "partial"
  | "paid"
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
  roomNumber?: string
  roomTypeDetail?: "ac" | "non_ac"
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
  /** When the payment was captured (set on confirm / webhook). */
  paidAt?: Timestamp | null
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
  cancellationReason?: string | null
  refundAmount: number
  /** none | refund_requested | approved | rejected | refunded. Legacy: "requested" treated as refund_requested, "processed" as refunded. */
  refundStatus: "none" | "refund_requested" | "approved" | "rejected" | "refunded" | "requested" | "processed"
  refundMethod?: "cash" | "upi" | "bank_transfer" | null
  refundDate?: Timestamp | null
  refundProcessedBy?: string | null
  gatewayRefundId?: string | null
  /** How the customer paid: online (gateway) or cash. Inferred from razorpayPaymentId if not set. */
  paymentMethod?: "online" | "cash" | null
  whatsappStatus?: "pending" | "sent" | "failed" | "disabled"
  whatsappSentAt?: Timestamp | null
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
  mobileNumber?: string
  authProvider?: "password" | "google" | "github" | "phone"
  photoURL: string
  favorites: string[]
  isBlocked: boolean
  role?: "user" | "admin" | "receptionist" | "staff" | "cleaner" | "watchman"
  referralCode?: string
  referredByCode?: string | null
  referredBy?: string | null
  referrerName?: string | null
  forcePasswordChange?: boolean
  createdByAdminUid?: string
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
  rewardMode?: "discount" | "cashback"
  discountType: "flat" | "percent"
  discountValue: number
  cashbackType?: "flat" | "percent"
  cashbackValue?: number
  maxCashbackAmount?: number
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
  receptionistPermissions?: Permission[]
  paymentRemindersEnabled?: boolean
  /** System default check-in time (HH:mm). Used when listing has no override. */
  defaultCheckInTime?: string
  /** System default check-out time (HH:mm). Used when listing has no override. */
  defaultCheckOutTime?: string
  /** Refund policy rules: days before event → refund percent. E.g. [{ daysBefore: 7, percent: 100 }, { daysBefore: 3, percent: 50 }, { daysBefore: 1, percent: 0 }]. Applied in order (first matching rule wins). */
  refundPolicyRules?: Array<{ daysBefore: number; percent: number }>
}

export interface SecureSettings {
  razorpaySecretKey: string
  /** Razorpay webhook secret for verifying payment.captured / payment.failed. */
  razorpayWebhookSecret?: string
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
  | "view_dashboard"
  | "view_bookings"
  | "create_booking"
  | "edit_booking"
  | "cancel_booking"
  | "view_customers"
  | "create_customer"
  | "edit_customer"
  | "view_payments"
  | "create_payment_receipt"
  | "view_rooms"
  | "check_in"
  | "check_out"
  | "view_reports"
  | "export_reports"
  | "view_settings"
  | "view_calendar"
  | "manage_visitors"
  | "send_whatsapp"
  | "manage_payment_reminders"

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

export type VisitorLeadStatus =
  | "new"
  | "follow_up"
  | "interested"
  | "converted"
  | "not_interested"

export interface VisitorLead {
  id: string
  name: string
  phone: string
  eventType: ListingType | "other"
  preferredDate: string
  notes: string
  status: VisitorLeadStatus
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
  convertedBookingId?: string | null
}

// =====================
// Gallery
// =====================

export interface GalleryItem {
  id: string
  imageUrl: string
  storagePath: string
  title: string
  description: string
  uploadedBy?: string
  sortOrder?: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

// =====================
// Rewards + Referral
// =====================
export type WalletTransactionSource =
  | "referral_reward"
  | "scratch_card"
  | "spin_wheel"
  | "daily_login"
  | "cashback"
  | "admin_adjustment"
  | "booking_payment"
  | "leaderboard_bonus"

export interface UserWallet {
  id: string
  userId: string
  balance: number
  totalEarned: number
  totalSpent: number
  updatedAt: Timestamp
  createdAt: Timestamp
}

export interface WalletTransaction {
  id: string
  userId: string
  amount: number
  type: "credit" | "debit"
  source: WalletTransactionSource
  description: string
  referenceId: string
  createdAt: Timestamp
  createdBy: string
}

export interface ReferralProfile {
  id: string
  userId: string
  referralCode: string
  referredByCode?: string | null
  referredByUserId?: string | null
  pendingReferrals: number
  successfulReferrals: number
  totalReferrals: number
  rewardEarned: number
  updatedAt: Timestamp
  createdAt: Timestamp
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
