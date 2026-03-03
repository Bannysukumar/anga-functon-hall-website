# Attendance Module

## Overview

Attendance supports:

- Admin-marked attendance
- Staff self-attendance (validated by Cloud Function)
- Role-restricted visibility:
  - Admin: all attendance
  - Staff: own attendance only

## Collections

- `workLocations`
  - `name`, `address`
  - `geoPoint { lat, lng }`
  - `radiusMeters`
  - `branchId`, `active`
- `schedules`
  - `name`
  - `daysOfWeek` (1..7, Mon..Sun)
  - `startTime`, `endTime` (HH:mm)
  - `graceMinutes`
  - `branchId`, `active`
- `attendance`
  - doc id format: `{userId}_{YYYYMMDD}_{scheduleId}`
  - `userId`, `roleId`, `branchId`, `scheduleId`, `workLocationId`
  - `dateKey`, `status`, `method`
  - `capturedAt`
  - `geo`, `distanceMeters`
  - `notes`, `createdBy`, `updatedAt`, `updatedBy`

## Cloud Function

- `createSelfAttendance` (callable)
- Source: `functions/src/index.ts`
- Validation done server-side:
  - user authenticated and not blocked
  - staff profile exists and active
  - role has `ATTENDANCE_SELF_MARK`
  - assigned schedule + location exist and active
  - current server day/time in allowed window
  - GPS distance within location radius (Haversine)
  - duplicate check for same user/date/schedule
- Writes attendance from server only

## Admin UIs Added

- `/admin/work-locations`
- `/admin/schedules`
- `/admin/attendance`
  - filters: date range, role, staff, status
  - manual mark/override
  - CSV export
  - summary cards (total/present/late/absent/not marked)

## Staff UIs Added

- `/dashboard/my-attendance`
  - today schedule/location
  - geolocation-based mark button
  - monthly summary
  - recent history

## Staff Usage Flow

1. Open `/dashboard/my-attendance`.
2. Review assigned schedule and location.
3. Tap **Mark Attendance**.
4. Grant location permission.
5. If valid, attendance is saved as `PRESENT` or `LATE`.
6. If invalid, clear reason is shown (inactive/outside time/radius/not permitted/already marked).
