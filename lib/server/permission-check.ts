import { adminAuth, adminDb } from "@/lib/server/firebase-admin"
import type { Permission } from "@/lib/types"

function readBearerToken(request: Request): string {
  const authHeader = request.headers.get("authorization") || ""
  if (!authHeader.startsWith("Bearer ")) return ""
  return authHeader.slice("Bearer ".length).trim()
}

export function canAccessByRole(
  role: string,
  receptionistPermissions: Permission[],
  required: Permission
) {
  if (role === "admin") return true
  if (role === "receptionist" && hasPermission(receptionistPermissions, required)) return true
  return false
}

const PERMISSION_ALIASES: Record<Permission, Permission[]> = {
  BOOKINGS_VIEW: ["view_bookings"],
  BOOKINGS_UPDATE_STATUS: ["edit_booking", "cancel_booking", "check_in", "check_out"],
  BOOKINGS_CREATE_MANUAL: ["create_booking"],
  LISTINGS_VIEW: ["view_rooms"],
  LISTINGS_CREATE_EDIT: [],
  LISTINGS_DELETE: [],
  PAYMENTS_VIEW: ["view_payments"],
  REFUNDS_MANAGE: [],
  USERS_VIEW: ["view_customers"],
  USERS_BLOCK_UNBLOCK: [],
  STAFF_ASSIGN_ROLE: [],
  ATTENDANCE_VIEW_ALL: [],
  ATTENDANCE_MARK_FOR_OTHERS: [],
  ATTENDANCE_SELF_MARK: [],
  CMS_EDIT: [],
  SETTINGS_EDIT: ["view_settings"],
  view_dashboard: [],
  view_bookings: [],
  create_booking: [],
  edit_booking: [],
  cancel_booking: [],
  view_customers: [],
  create_customer: [],
  edit_customer: [],
  view_payments: [],
  create_payment_receipt: [],
  view_rooms: [],
  check_in: [],
  check_out: [],
  view_reports: [],
  export_reports: [],
  view_settings: [],
}

function hasPermission(permissions: Permission[], required: Permission) {
  if (permissions.includes(required)) return true
  const aliases = PERMISSION_ALIASES[required] || []
  return aliases.some((alias) => permissions.includes(alias))
}

function isAdminEmail(email: string) {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return false
  const configured =
    process.env.ADMIN_EMAILS ||
    process.env.NEXT_PUBLIC_ADMIN_EMAILS ||
    ""
  const adminEmails = configured
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
  return adminEmails.includes(normalized)
}

export async function requirePermission(request: Request, permission: Permission) {
  const token = readBearerToken(request)
  if (!token) {
    throw new Error("UNAUTHORIZED")
  }

  const decoded = await adminAuth.verifyIdToken(token)
  const uid = decoded.uid
  const [userSnap, staffSnap] = await Promise.all([
    adminDb.collection("users").doc(uid).get(),
    adminDb.collection("staff").doc(uid).get(),
  ])
  const user = userSnap.exists ? userSnap.data() || {} : {}
  const staff = staffSnap.exists ? staffSnap.data() || {} : {}
  const email = String(decoded.email || user.email || "")
  const role = String(user.role || "")

  if (Boolean(user.isBlocked)) throw new Error("BLOCKED")

  if (role === "admin" || isAdminEmail(email)) {
    return { uid, role: "admin", user }
  }

  if (role === "receptionist") {
    const settingsSnap = await adminDb.collection("settings").doc("global").get()
    const receptionistPermissions = settingsSnap.exists
      ? (settingsSnap.data()?.receptionistPermissions as Permission[] | undefined) || []
      : []
    if (!canAccessByRole(role, receptionistPermissions, permission)) {
      throw new Error("FORBIDDEN")
    }
    return { uid, role, user }
  }

  if (staffSnap.exists) {
    if (staff.active === false) throw new Error("BLOCKED")
    let effectivePermissions = Array.isArray(staff.effectivePermissions)
      ? (staff.effectivePermissions as Permission[])
      : []

    if (effectivePermissions.length === 0) {
      const roleIds = [String(staff.roleId || ""), ...((staff.extraRoleIds as string[]) || [])].filter(
        Boolean
      )
      if (roleIds.length > 0) {
        const roleSnaps = await Promise.all(
          roleIds.map((id) => adminDb.collection("roles").doc(id).get())
        )
        const fromRoles = roleSnaps.flatMap((snap) =>
          snap.exists ? ((snap.data()?.permissions as Permission[]) || []) : []
        )
        effectivePermissions = Array.from(new Set(fromRoles))
      }
    }

    if (!hasPermission(effectivePermissions, permission)) {
      throw new Error("FORBIDDEN")
    }
    return { uid, role: "staff", user: userSnap.exists ? user : null, staffProfile: staff }
  }

  if (!userSnap.exists) throw new Error("USER_NOT_FOUND")

  throw new Error("FORBIDDEN")
}

export function toHttpError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal error"
  if (message === "UNAUTHORIZED") return { status: 401, error: "Unauthorized" }
  if (message === "FORBIDDEN") return { status: 403, error: "Access denied" }
  if (message === "USER_NOT_FOUND") return { status: 403, error: "User profile not found" }
  if (message === "BLOCKED") return { status: 403, error: "Account is blocked" }
  return { status: 500, error: "Unexpected server error" }
}
