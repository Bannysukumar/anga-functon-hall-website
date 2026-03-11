import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth"
import { auth } from "./firebase"

const googleProvider = new GoogleAuthProvider()

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

