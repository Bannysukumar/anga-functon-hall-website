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
  checked_in: "Checked In",
  checked_out: "Checked Out",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  partial: "Partial",
  paid: "Paid",
  advance_paid: "Advance Paid",
  fully_paid: "Fully Paid",
  refund_requested: "Refund Requested",
  refunded: "Refunded",
}

export const BOOKING_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  checked_in: "bg-indigo-100 text-indigo-800",
  checked_out: "bg-slate-100 text-slate-800",
  completed: "bg-sky-100 text-sky-800",
  cancelled: "bg-red-100 text-red-800",
  no_show: "bg-zinc-100 text-zinc-800",
}

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  partial: "bg-sky-100 text-sky-800",
  paid: "bg-emerald-100 text-emerald-800",
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
  siteLogoUrl: "",
  refundPolicyText:
    "Cancellations made 48 hours before check-in are eligible for a full refund. Late cancellations may be subject to partial refunds based on the listing's policy.",
  minAdvancePercent: 25,
  maxBookingWindowDays: 90,
  razorpayKeyId: "",
  razorpayDisplayName: "Anga Function Hall",
  heroBanners: [
    {
      imageUrl: "/image.jpeg",
      title: "Home Banner 1",
      subtitle: "",
    },
    {
      imageUrl: "/image1.jpeg",
      title: "Home Banner 2",
      subtitle: "",
    },
    {
      imageUrl: "/image2.jpeg",
      title: "Home Banner 3",
      subtitle: "",
    },
  ],
  featuredListingIds: [],
  bookingEmailSubjectTemplate: "Your Booking Confirmation - Anga Function Hall",
  bookingEmailHtmlTemplate:
    "<p>Hello {userName},</p><p>Your booking at Anga Function Hall is confirmed.</p><p><strong>Booking ID:</strong> {bookingId}</p><p><strong>Event Date:</strong> {dates}</p><p><strong>Hall/Room:</strong> {listingName}</p><p><strong>Booking Amount:</strong> INR {bookingAmount}</p><p><strong>Status:</strong> {bookingStatus}</p><p><a href='{invoiceLink}'>Download Invoice</a></p>",
  checkoutEmailSubjectTemplate: "Thank You for Choosing Anga Function Hall",
  checkoutEmailHtmlTemplate:
    "<p>Hello {userName},</p><p>Your event is completed successfully.</p><p><strong>Booking ID:</strong> {bookingId}</p><p><strong>Event Date:</strong> {eventDate}</p><p><strong>Checkout Date:</strong> {checkOutAt}</p><p><strong>Total Amount Paid:</strong> INR {paidAmount}</p><p>Thank you for choosing Anga Function Hall.</p>",
  paymentRemindersEnabled: true,
  socialLinks: [
    {
      platform: "instagram",
      label: "Instagram",
      url: "https://www.instagram.com/angafunction/",
    },
    {
      platform: "facebook",
      label: "Facebook",
      url: "https://www.facebook.com/profile.php?viewas=100000686899395&id=61586457726808",
    },
    {
      platform: "youtube",
      label: "YouTube",
      url: "https://www.youtube.com/@angafunctonhall",
    },
  ],
  receptionistPermissions: [
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
  ],
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
  view_dashboard: "View dashboard",
  view_bookings: "View bookings",
  create_booking: "Create booking",
  edit_booking: "Edit booking",
  cancel_booking: "Cancel booking",
  view_customers: "View customers",
  create_customer: "Create customer",
  edit_customer: "Edit customer",
  view_payments: "View payments",
  create_payment_receipt: "Create payment receipt",
  view_rooms: "View rooms",
  check_in: "Check-in booking",
  check_out: "Check-out booking",
  view_reports: "View reports",
  export_reports: "Export reports",
  view_settings: "View settings",
  view_calendar: "View booking calendar",
  manage_visitors: "Manage visitor leads",
  send_whatsapp: "Send WhatsApp messages",
  manage_payment_reminders: "Manage payment reminders",
}

export const ALL_PERMISSIONS: Permission[] = Object.keys(
  PERMISSION_LABELS
) as Permission[]
