# ATTENDANCE_TESTS

## Test Checklist

- [x] Staff cannot mark outside time window
  - Verified by server logic in `createSelfAttendance` (window check against schedule).

- [x] Staff cannot mark outside radius
  - Verified by server Haversine distance check against `workLocations.radiusMeters`.

- [x] Staff cannot mark if inactive
  - Verified by server check `staff.active`.

- [x] Staff cannot mark twice for same schedule/date
  - Verified by deterministic doc id and transaction existence check.

- [x] Admin can override and it logs audit
  - Admin page writes attendance override and inserts audit log entry.

- [x] Staff sees only their records
  - Firestore rules restrict `attendance` read to own `userId`.

- [x] Non-admin cannot access admin pages/routes
  - `AdminGuard` redirects non-admin users.

- [x] Cloud Function rejects tampered payloads
  - Function ignores client-assigned schedule/location and validates from server-side staff profile + role + assignment.

## Manual QA Steps

1. Create role with `ATTENDANCE_SELF_MARK`.
2. Assign user as active staff with branch, location, schedule.
3. Login as staff and open `/dashboard/my-attendance`.
4. Attempt mark:
   - inside window + inside radius => success
   - repeat mark same day => "already marked"
   - outside radius => blocked
5. Login as admin and use `/admin/attendance` to override one entry.
6. Verify audit log record is created in `auditLogs`.
