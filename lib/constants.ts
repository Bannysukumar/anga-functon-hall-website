import type { ListingType, Permission } from "./types"

export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  function_hall: "Function Hall",
  room: "Room",
  dormitory: "Dormitory",
  dining_hall: "Dining Hall",
  open_function_hall: "Open Function Hall",
  local_tour: "Local Tour",
}

export const LISTING_TYPE_ICONS: Record<ListingType, string> = {
  function_hall: "building-2",
  room: "bed-double",
  dormitory: "hotel",
  dining_hall: "utensils",
  open_function_hall: "tent",
  local_tour: "map-pin",
}

export const LISTING_TYPES: ListingType[] = [
  "function_hall",
  "room",
  "dormitory",
  "dining_hall",
  "open_function_hall",
  "local_tour",
]

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  advance_paid: "Advance Paid",
  fully_paid: "Fully Paid",
  refund_requested: "Refund Requested",
  refunded: "Refunded",
}

export const BOOKING_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  completed: "bg-sky-100 text-sky-800",
  cancelled: "bg-red-100 text-red-800",
}

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  advance_paid: "bg-sky-100 text-sky-800",
  fully_paid: "bg-emerald-100 text-emerald-800",
  refund_requested: "bg-orange-100 text-orange-800",
  refunded: "bg-red-100 text-red-800",
}

export const DEFAULT_SETTINGS = {
  serviceFeePercent: 5,
  taxPercent: 18,
  contactEmail: "angafunctonhall@gmail.com",
  contactPhone: "098855 55729",
  refundPolicyText:
    "Cancellations made 48 hours before check-in are eligible for a full refund. Late cancellations may be subject to partial refunds based on the listing's policy.",
  minAdvancePercent: 25,
  maxBookingWindowDays: 90,
  razorpayKeyId: "",
  razorpayDisplayName: "Anga Function Hall",
  heroBanners: [],
  featuredListingIds: [],
}

export const AMENITY_OPTIONS = [
  "WiFi",
  "AC",
  "Parking",
  "CCTV",
  "Power Backup",
  "Stage",
  "Sound System",
  "Projector",
  "Decoration",
  "Catering",
  "Kitchen",
  "Elevator",
  "Swimming Pool",
  "Garden",
  "Restrooms",
  "Wheelchair Access",
  "Security",
  "Water Supply",
]

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Chandigarh",
  "Puducherry",
]

export const PERMISSION_LABELS: Record<Permission, string> = {
  BOOKINGS_VIEW: "View bookings",
  BOOKINGS_UPDATE_STATUS: "Update booking status",
  BOOKINGS_CREATE_MANUAL: "Create manual bookings",
  LISTINGS_VIEW: "View listings",
  LISTINGS_CREATE_EDIT: "Create/edit listings",
  LISTINGS_DELETE: "Delete listings",
  PAYMENTS_VIEW: "View payments",
  REFUNDS_MANAGE: "Manage refunds",
  USERS_VIEW: "View users",
  USERS_BLOCK_UNBLOCK: "Block/unblock users",
  STAFF_ASSIGN_ROLE: "Assign staff roles",
  ATTENDANCE_VIEW_ALL: "View all attendance",
  ATTENDANCE_MARK_FOR_OTHERS: "Mark attendance for others",
  ATTENDANCE_SELF_MARK: "Mark own attendance",
  CMS_EDIT: "Edit CMS content",
  SETTINGS_EDIT: "Edit system settings",
}

export const ALL_PERMISSIONS: Permission[] = Object.keys(
  PERMISSION_LABELS
) as Permission[]
