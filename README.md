# Anga Function Hall - RBAC & Receptionist Dashboard

## Overview

This project includes:

- Admin dashboard (full access)
- Receptionist dashboard (`/receptionist`) with DB-driven permission toggles
- Firestore-backed role and permission controls
- Route guards and access-denied flow
- Audit logging for role/permission and booking-related actions

## Environment Variables

Create `.env.local` / `.env.production` as needed:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

For RBAC seeding script:

- `GOOGLE_APPLICATION_CREDENTIALS` (path to service account JSON)

## Install & Run

```bash
npm install
npm run build
npm start
```

## Seed Roles & Permissions

This creates/updates receptionist role + default receptionist permissions in `settings/global`.

```bash
npm run seed:rbac
```

## Receptionist Access Model

- Admin has hard override (all access).
- Receptionist access is controlled by:
  - `settings/global.receptionistPermissions`
  - toggles in Admin Settings -> Roles & Permissions.
- UI and Firestore rules both enforce access.
- Receptionist APIs are token-verified and permission-checked server-side.

## Routes

- Admin: `/admin/*`
- Receptionist: `/receptionist/*`
  - `/receptionist`
  - `/receptionist/bookings`
  - `/receptionist/customers`
  - `/receptionist/customers/[id]`
  - `/receptionist/payments`
  - `/receptionist/rooms`
  - `/receptionist/reports`
  - `/receptionist/settings`
- Access denied page: `/access-denied`

## Receptionist API Endpoints

- `GET/POST /api/receptionist/bookings`
- `PATCH /api/receptionist/bookings/[id]`
- `GET/POST /api/receptionist/customers`
- `GET/PUT /api/receptionist/customers/[id]`
- `GET/POST /api/receptionist/payments`
- `GET /api/receptionist/reports` (supports `json`, `csv`, `pdf`)

## Deployment Steps

1. Pull latest code
2. Install dependencies
3. Build app
4. Run RBAC seed (once per environment)
5. Restart process manager (PM2/systemd)

Example:

```bash
git pull origin main
npm ci
npm run build
npm run seed:rbac
pm2 restart angafunctionhall --update-env
pm2 save
```

## Testing Checklist

### Admin

- Can assign role `admin` / `receptionist` / `user`
- Can change receptionist permission toggles and save
- Receptionist visible modules update after refresh/re-login

### Receptionist

- Cannot open admin-only pages
- Can only access `/receptionist/*` modules granted by permission
- Blocked actions show access denied behavior

### Permission Enforcement

- Disable `create_booking` -> booking creation path unavailable
- Disable `view_settings` -> receptionist settings route blocked
- Firestore rules block unauthorized read/write attempts

### Audit Logs

- Role updates
- User block/unblock
- Password reset actions
- Role/permission changes

