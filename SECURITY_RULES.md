# Security Rules and Access Model

## Firestore Rules Highlights

Updated file: `firestore.rules`

### Admin

- Full read/write over:
  - `roles`, `staff`, `workLocations`, `schedules`, `attendance`, `auditLogs`
  - existing operational collections (`bookings`, `payments`, etc.)

### Staff / User Restrictions

- `staff`: users can read only their own profile
- `attendance`: users can read only their own records
- direct client create/update on attendance is blocked (admin-only write)
- role and security-sensitive writes are admin-only

### Why Self-Attendance is Not Client-Writable

Firestore rules alone cannot safely validate:

- server-authoritative current time window
- geofence distance integrity
- anti-tamper payload logic

Therefore, self-attendance must go through `createSelfAttendance` Cloud Function.

## Storage/Other Security

- Existing storage rules remain enforced.
- Booking/payment secure flow remains server-validated.

## Deployment Notes

- Firestore rules deployed successfully to project `anga-functon-hall-e813b`.
- Cloud Function `createSelfAttendance` deployed successfully (us-central1).
- Firebase CLI returned a post-deploy warning about artifact cleanup policy; function itself is active.
