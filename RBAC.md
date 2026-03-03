# RBAC Module

## Overview

This platform now includes role-based access control (RBAC) for staff operations while keeping **Admin** as the only full-control authority.

## Collections

- `roles`
  - `roleName`
  - `description`
  - `permissions[]`
  - `createdAt`, `updatedAt`
- `staff` (doc id = `userId`)
  - `userId`, `name`, `phone`, `email`
  - `roleId` (primary role)
  - `extraRoleIds[]` (optional additional roles)
  - `branchId`, `workLocationId`, `scheduleId`
  - `active`
  - `createdAt`, `updatedAt`
- `auditLogs`
  - role/staff/attendance admin actions

## Permissions Implemented

- `BOOKINGS_VIEW`
- `BOOKINGS_UPDATE_STATUS`
- `BOOKINGS_CREATE_MANUAL`
- `LISTINGS_VIEW`
- `LISTINGS_CREATE_EDIT`
- `LISTINGS_DELETE`
- `PAYMENTS_VIEW`
- `REFUNDS_MANAGE`
- `USERS_VIEW`
- `USERS_BLOCK_UNBLOCK`
- `STAFF_ASSIGN_ROLE`
- `ATTENDANCE_VIEW_ALL`
- `ATTENDANCE_MARK_FOR_OTHERS`
- `ATTENDANCE_SELF_MARK`
- `CMS_EDIT`
- `SETTINGS_EDIT`

## Admin UIs Added

- `/admin/roles` - Role Manager (create/edit/delete permissions)
- `/admin/staff` - Staff Manager (assign role, branch, location, schedule, active status)

## Staff UX Added

- `/dashboard/my-role` - view assigned role + effective permissions

## How to Create First Admin Email(s)

1. Create user account using normal signup.
2. In Firestore `users/{uid}`, set `role: "admin"` for that user.
3. Optionally also set Firebase custom claim `admin: true`.
4. Re-login to refresh token and load admin access.

## How to Create Roles and Assign Staff

1. Login as admin.
2. Go to `/admin/roles` and create roles with selected permissions.
3. Go to `/admin/staff` and assign each staff:
   - primary role (`roleId`)
   - optional extra roles (`extraRoleIds`)
   - branch, work location, schedule
   - active/inactive status
