"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { onAuthStateChanged, type User } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { getRoles, getSettings, getStaffProfile, getUser } from "@/lib/firebase-db"
import type { AppUser, Permission, StaffProfile } from "@/lib/types"

interface AuthContextType {
  user: User | null
  appUser: AppUser | null
  staffProfile: StaffProfile | null
  permissions: Permission[]
  loading: boolean
  isAdminUser: boolean
  hasPermission: (permission: Permission) => boolean
  hasAnyPermission: (permissions: Permission[]) => boolean
  refreshUser: () => Promise<void>
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
  view_calendar: ["view_bookings"],
  manage_visitors: ["view_customers", "edit_customer"],
  send_whatsapp: ["edit_booking"],
  manage_payment_reminders: ["view_payments"],
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  appUser: null,
  staffProfile: null,
  permissions: [],
  loading: true,
  isAdminUser: false,
  hasPermission: () => false,
  hasAnyPermission: () => false,
  refreshUser: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null)
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdminUser, setIsAdminUser] = useState(false)

  const loadPermissionContext = async (firebaseUser: User) => {
    const [userData, staffData] = await Promise.all([
      getUser(firebaseUser.uid),
      getStaffProfile(firebaseUser.uid),
    ])
    setAppUser(userData)
    setStaffProfile(staffData)
    const adminUser = userData?.role === "admin"
    setIsAdminUser(adminUser)
    if (adminUser) {
      setPermissions([])
      return
    }
    if (userData?.role === "receptionist") {
      const settings = await getSettings()
      setPermissions(settings.receptionistPermissions || [])
      return
    }
    if (staffData?.effectivePermissions?.length) {
      setPermissions(staffData.effectivePermissions)
      return
    }
    if (!staffData?.roleId) {
      setPermissions([])
      return
    }
    const roles = await getRoles()
    const roleMap = new Map(roles.map((role) => [role.id, role]))
    const ids = [staffData.roleId, ...(staffData.extraRoleIds || [])]
    const permissionSet = new Set<Permission>()
    ids.forEach((id) => {
      const role = roleMap.get(id)
      role?.permissions.forEach((perm) => permissionSet.add(perm))
    })
    setPermissions(Array.from(permissionSet))
  }

  const refreshUser = async () => {
    if (user) {
      await loadPermissionContext(user)
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)

      if (firebaseUser) {
        // Refresh token so newly assigned custom claims are available immediately.
        await firebaseUser.getIdToken(true)
        await loadPermissionContext(firebaseUser)
      } else {
        setIsAdminUser(false)
        setAppUser(null)
        setStaffProfile(null)
        setPermissions([])
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const hasPermissionWithAliases = (permission: Permission) => {
    if (isAdminUser) return true
    if (permissions.includes(permission)) return true
    const aliases = PERMISSION_ALIASES[permission] || []
    return aliases.some((alias) => permissions.includes(alias))
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        appUser,
        staffProfile,
        permissions,
        loading,
        isAdminUser,
        hasPermission: hasPermissionWithAliases,
        hasAnyPermission: (items: Permission[]) =>
          items.some((permission) => hasPermissionWithAliases(permission)),
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
