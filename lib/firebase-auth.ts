import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { auth, db } from "./firebase"

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
  const cred = await signInWithPopup(auth, googleProvider)
  const userDoc = await getDoc(doc(db, "users", cred.user.uid))
  if (!userDoc.exists()) {
    await signOut(auth)
    throw new Error(
      "Google signup is disabled. Please create your account using mobile number and referral code."
    )
  }
  return cred.user
}

export async function logOut() {
  await signOut(auth)
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email)
}

