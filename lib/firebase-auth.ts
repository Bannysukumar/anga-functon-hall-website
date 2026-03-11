import {
  type ApplicationVerifier,
  type ConfirmationResult,
  createUserWithEmailAndPassword,
  deleteUser,
  GithubAuthProvider,
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
} from "firebase/auth"
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore"
import { auth } from "./firebase"
import { db } from "./firebase"

const googleProvider = new GoogleAuthProvider()
const githubProvider = new GithubAuthProvider()

type AuthProviderKind = "password" | "google" | "github" | "phone"

function normalizeIndianPhone(value: string): string {
  const raw = String(value || "").replace(/[^\d+]/g, "")
  if (raw.startsWith("+")) return raw
  if (/^\d{10}$/.test(raw)) return `+91${raw}`
  if (/^91\d{10}$/.test(raw)) return `+${raw}`
  return raw
}

async function ensureUserRecord(user: User, provider: AuthProviderKind) {
  const userRef = doc(db, "users", user.uid)
  const userSnap = await getDoc(userRef)
  const displayName = String(user.displayName || "User").trim() || "User"
  const email = String(user.email || "").trim().toLowerCase()
  const phone = String(user.phoneNumber || "").trim()
  const photoURL = String(user.photoURL || "").trim()

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      email,
      displayName,
      phone,
      mobileNumber: phone ? phone.replace(/\D/g, "").slice(-10) : "",
      photoURL,
      favorites: [],
      isBlocked: false,
      role: "user",
      authProvider: provider,
      createdAt: serverTimestamp(),
      signupDate: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return
  }

  const existing = userSnap.data() || {}
  await setDoc(
    userRef,
    {
      displayName: displayName || String(existing.displayName || "User"),
      email: email || String(existing.email || ""),
      phone: phone || String(existing.phone || ""),
      photoURL: photoURL || String(existing.photoURL || ""),
      authProvider: String(existing.authProvider || provider),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

export async function signUp(
  email: string,
  password: string,
  displayName: string,
  mobileNumber: string,
  referredByCode?: string,
  deviceId?: string
) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  try {
    await updateProfile(cred.user, { displayName })
    const idToken = await cred.user.getIdToken()
    const response = await fetch("/api/auth/complete-signup", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        displayName,
        mobileNumber,
        referralCode: referredByCode?.trim().toUpperCase() || "",
        deviceId: deviceId || "",
      }),
    })
    const payload = (await response.json()) as { ok?: boolean; error?: string }
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Signup failed")
    }
  } catch (error) {
    await deleteUser(cred.user)
    throw error
  }
  return cred.user
}

export async function logIn(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  return cred.user
}

export async function logInWithGoogle() {
  try {
    const cred = await signInWithPopup(auth, googleProvider)
    const idToken = await cred.user.getIdToken()
    const response = await fetch("/api/auth/google-onboard", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: cred.user.email || "",
        displayName: cred.user.displayName || "",
        photoURL: cred.user.photoURL || "",
      }),
    })
    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    if (!response.ok || !payload.ok) {
      await signOut(auth)
      throw new Error(payload.error || "Google sign-in failed.")
    }
    return cred.user
  } catch (error) {
    const code = (error as { code?: string } | null)?.code
    if (code === "auth/operation-not-allowed") {
      throw new Error(
        "Google sign-in is currently disabled in Firebase Authentication. Please enable the Google provider in Firebase Console or sign in with email and password."
      )
    }
    throw error
  }
}

export async function logInWithGitHub() {
  try {
    const cred = await signInWithPopup(auth, githubProvider)
    await ensureUserRecord(cred.user, "github")
    return cred.user
  } catch (error) {
    const code = (error as { code?: string } | null)?.code
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      throw new Error("GitHub login cancelled.")
    }
    if (code === "auth/account-exists-with-different-credential") {
      throw new Error("An account already exists with this email using a different sign-in method.")
    }
    throw error
  }
}

export function createPhoneRecaptcha(
  containerId = "recaptcha-container",
  mode: "invisible" | "normal" = "normal",
  options?: {
    callback?: () => void
    expiredCallback?: () => void
    errorCallback?: () => void
  }
) {
  if (typeof window === "undefined") {
    throw new Error("Phone login is only available in browser.")
  }
  auth.languageCode = "en"
  return new RecaptchaVerifier(auth, containerId, {
    size: mode,
    callback: options?.callback,
    "expired-callback": options?.expiredCallback,
    "error-callback": options?.errorCallback,
  })
}

export async function sendPhoneOtp(
  phoneNumber: string,
  appVerifier: ApplicationVerifier
): Promise<ConfirmationResult> {
  const normalized = normalizeIndianPhone(phoneNumber)
  if (!/^\+91[6-9]\d{9}$/.test(normalized)) {
    throw new Error("Invalid phone number. Enter a valid +91 mobile number.")
  }
  return signInWithPhoneNumber(auth, normalized, appVerifier)
}

export async function verifyPhoneOtp(confirmationResult: ConfirmationResult, otp: string) {
  const code = String(otp || "").trim()
  if (!/^\d{6}$/.test(code)) {
    throw new Error("Invalid OTP. Please enter the 6-digit verification code.")
  }
  const cred = await confirmationResult.confirm(code)
  await ensureUserRecord(cred.user, "phone")
  return cred.user
}

export async function logOut() {
  await signOut(auth)
}

export async function resetPassword(email: string) {
  const response = await fetch("/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  })
  const payload = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) {
    throw new Error(payload.error || "Failed to send reset email")
  }
}

