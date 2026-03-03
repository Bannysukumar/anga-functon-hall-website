# SMTP Setup

Configure these Cloud Functions environment variables:

- `SMTP_HOST`
- `SMTP_PORT` (for example `465` or `587`)
- `SMTP_SECURE` (`true` for SSL/465, `false` for TLS/587)
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM_NAME`
- `SMTP_FROM_EMAIL`
- `APP_BASE_URL` (for secure invoice link route)
- `ADMIN_NOTIFICATION_EMAIL` (optional)

## Recommended Notes
- Use app passwords for providers like Gmail/Outlook/Zoho when required.
- Never expose SMTP credentials in frontend env files.
- Keep SMTP credentials only in Cloud Functions runtime config.
- Test by creating one paid booking and verifying `emailStatus` in booking/invoice docs.

## Runtime Behavior
- Function verifies SMTP transport on startup.
- Email send retries up to 3 attempts.
- Logs are recorded in `emailLogs` with success/failure details.
