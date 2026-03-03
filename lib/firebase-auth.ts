import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
} from "firebase/auth"
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore"
import { auth, db } from "./firebase"

const googleProvider = new GoogleAuthProvider()

export async function signUp(
  email: string,
  password: string,
  displayName: string
) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(cred.user, { displayName })
  await setDoc(doc(db, "users", cred.user.uid), {
    email,
    displayName,
    phone: "",
    photoURL: "",
    favorites: [],
    isBlocked: false,
    role: "user",
    createdAt: serverTimestamp(),
  })
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
    await setDoc(doc(db, "users", cred.user.uid), {
      email: cred.user.email || "",
      displayName: cred.user.displayName || "",
      phone: cred.user.phoneNumber || "",
      photoURL: cred.user.photoURL || "",
      favorites: [],
      isBlocked: false,
      role: "user",
      createdAt: serverTimestamp(),
    })
  }
  return cred.user
}

export async function logOut() {
  await signOut(auth)
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email)
}

export function isAdmin(user: User | null): boolean {
  if (!user?.email) return false
  const adminEmails =
    process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",").map((e) =>
      e.trim().toLowerCase()
    ) || []
  return adminEmails.includes(user.email.toLowerCase())
}
