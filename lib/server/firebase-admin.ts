import { getApps, initializeApp, cert, type App } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"
import { existsSync, readFileSync } from "node:fs"

function getFirebaseAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0]
  }

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")
  const fallbackProjectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    })
  }

  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(serviceAccountJson) as {
        project_id?: string
        client_email?: string
        private_key?: string
      }
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        return initializeApp({
          credential: cert({
            projectId: parsed.project_id,
            clientEmail: parsed.client_email,
            privateKey: parsed.private_key.replace(/\\n/g, "\n"),
          }),
        })
      }
    } catch {
      // Continue to other strategies
    }
  }

  if (serviceAccountPath && existsSync(serviceAccountPath)) {
    try {
      const raw = readFileSync(serviceAccountPath, "utf8")
      const parsed = JSON.parse(raw) as {
        project_id?: string
        client_email?: string
        private_key?: string
      }
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        return initializeApp({
          credential: cert({
            projectId: parsed.project_id,
            clientEmail: parsed.client_email,
            privateKey: parsed.private_key.replace(/\\n/g, "\n"),
          }),
        })
      }
    } catch {
      // Continue to fallback
    }
  }

  if (fallbackProjectId) {
    return initializeApp({ projectId: fallbackProjectId })
  }

  return initializeApp()
}

const adminApp = getFirebaseAdminApp()

export const adminAuth = getAuth(adminApp)
export const adminDb = getFirestore(adminApp)
