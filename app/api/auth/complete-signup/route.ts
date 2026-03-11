import { randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"
import { adminAuth, adminDb } from "@/lib/server/firebase-admin"
import { sendSignupSuccessEmail } from "@/lib/server/auth-email"

function readBearerToken(request: Request): string {
  const authHeader = request.headers.get("authorization") || ""
  if (!authHeader.startsWith("Bearer ")) return ""
  return authHeader.slice("Bearer ".length).trim()
}

function normalizeReferralCode(value: string): string {
  return String(value || "").trim().toUpperCase()
}

function normalizeMobile(value: string): string {
  return String(value || "").replace(/\D/g, "")
}

function isValidIndianMobile(value: string): boolean {
  return /^[6-9]\d{9}$/.test(value)
}

function createReferralCandidate(): string {
  const token = randomBytes(4).toString("hex").toUpperCase()
  return `ANGA${token}`
}

async function resolveReferrer(referralCode: string) {
  const userQuery = await adminDb
    .collection("users")
    .where("referralCode", "==", referralCode)
    .limit(1)
    .get()
  if (!userQuery.empty) {
    const doc = userQuery.docs[0]
    const data = doc.data() || {}
    return { userId: doc.id, displayName: String(data.displayName || "User") }
  }

  const referralQuery = await adminDb
    .collection("referrals")
    .where("referralCode", "==", referralCode)
    .limit(1)
    .get()
  if (referralQuery.empty) return null

  const referrerId = referralQuery.docs[0].id
  const userSnap = await adminDb.collection("users").doc(referrerId).get()
  const userData = userSnap.data() || {}
  return { userId: referrerId, displayName: String(userData.displayName || "User") }
}

export async function POST(request: Request) {
  try {
    const idToken = readBearerToken(request)
    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const decoded = await adminAuth.verifyIdToken(idToken)
    const uid = decoded.uid

    const body = (await request.json()) as {
      email?: string
      displayName?: string
      mobileNumber?: string
      referralCode?: string
      deviceId?: string
    }

    const email = String(body.email || "").trim().toLowerCase()
    const displayName = String(body.displayName || "").trim()
    const mobileNumber = normalizeMobile(body.mobileNumber || "")
    const referredByCode = normalizeReferralCode(body.referralCode || "")
    const deviceId = String(body.deviceId || "").trim()

    if (!displayName || !email || !mobileNumber || !referredByCode) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 })
    }
    if (!isValidIndianMobile(mobileNumber)) {
      return NextResponse.json({ error: "Enter a valid 10-digit Indian mobile number." }, { status: 400 })
    }

    const [referrer, mobileNumberQuery, legacyPhoneQuery] = await Promise.all([
      resolveReferrer(referredByCode),
      adminDb.collection("users").where("mobileNumber", "==", mobileNumber).limit(1).get(),
      adminDb.collection("users").where("phone", "==", mobileNumber).limit(1).get(),
    ])
    if (!referrer) {
      return NextResponse.json({ error: "Invalid referral code" }, { status: 400 })
    }
    if (referrer.userId === uid) {
      return NextResponse.json({ error: "Self referral is not allowed." }, { status: 400 })
    }
    const duplicateDoc =
      mobileNumberQuery.docs.find((doc) => doc.id !== uid) ||
      legacyPhoneQuery.docs.find((doc) => doc.id !== uid)
    if (duplicateDoc) {
      return NextResponse.json({ error: "This mobile number is already registered." }, { status: 400 })
    }

    let createdReferralCode = ""
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = createReferralCandidate()
      try {
        await adminDb.runTransaction(async (transaction) => {
          const userRef = adminDb.collection("users").doc(uid)
          const mobileRef = adminDb.collection("mobileNumbers").doc(mobileNumber)
          const referralCodeRef = adminDb.collection("referralCodeIndex").doc(candidate)
          const referralRef = adminDb.collection("referrals").doc(uid)

          const [userSnap, mobileSnap, referralCodeSnap, referralSnap] = await Promise.all([
            transaction.get(userRef),
            transaction.get(mobileRef),
            transaction.get(referralCodeRef),
            transaction.get(referralRef),
          ])

          if (mobileSnap.exists && String(mobileSnap.data()?.userId || "") !== uid) {
            throw new Error("This mobile number is already registered.")
          }
          if (referralCodeSnap.exists) {
            throw new Error("REFERRAL_CODE_COLLISION")
          }

          const existingUser = userSnap.data() || {}
          transaction.set(
            userRef,
            {
              email,
              displayName,
              phone: mobileNumber,
              mobileNumber,
              photoURL: String(existingUser.photoURL || ""),
              favorites: Array.isArray(existingUser.favorites) ? existingUser.favorites : [],
              isBlocked: Boolean(existingUser.isBlocked || false),
              role: String(existingUser.role || "user"),
              authProvider: String(existingUser.authProvider || "password"),
              referralCode: String(existingUser.referralCode || candidate),
              referredByCode,
              referredBy: referrer.userId,
              referrerName: referrer.displayName,
              deviceId: deviceId || String(existingUser.deviceId || ""),
              signupDate: existingUser.signupDate || FieldValue.serverTimestamp(),
              createdAt: existingUser.createdAt || FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          )

          transaction.set(
            mobileRef,
            {
              mobileNumber,
              userId: uid,
              createdAt: mobileSnap.data()?.createdAt || FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          )

          transaction.set(referralCodeRef, {
            referralCode: candidate,
            userId: uid,
            createdAt: FieldValue.serverTimestamp(),
          })

          if (!referralSnap.exists) {
            transaction.set(
              referralRef,
              {
                userId: uid,
                referralCode: candidate,
                referredByCode,
                referredByUserId: referrer.userId,
                pendingReferrals: 0,
                successfulReferrals: 0,
                totalReferrals: 0,
                rewardEarned: 0,
                lifetimeSuccessfulReferrals: 0,
                lifetimeTotalReferrals: 0,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            )
          }
        })
        createdReferralCode = candidate
        break
      } catch (error) {
        const message = error instanceof Error ? error.message : "Signup failed"
        if (message === "REFERRAL_CODE_COLLISION") {
          continue
        }
        throw error
      }
    }

    if (!createdReferralCode) {
      return NextResponse.json({ error: "Could not generate referral code. Please retry." }, { status: 500 })
    }

    sendSignupSuccessEmail(email, displayName).catch((error) => {
      console.error("[complete-signup] Failed to send signup success email", error)
    })

    return NextResponse.json({
      ok: true,
      referralCode: createdReferralCode,
      referredBy: referrer.userId,
      referrerName: referrer.displayName,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signup failed"
    const status = message === "This mobile number is already registered." ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
