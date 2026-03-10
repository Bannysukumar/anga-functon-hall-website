import { NextResponse } from "next/server"
import { adminDb } from "@/lib/server/firebase-admin"

function normalizeReferralCode(value: string): string {
  return String(value || "").trim().toUpperCase()
}

function normalizeMobile(value: string): string {
  return String(value || "").replace(/\D/g, "")
}

function isValidIndianMobile(value: string): boolean {
  return /^[6-9]\d{9}$/.test(value)
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
    return {
      userId: doc.id,
      displayName: String(data.displayName || "User"),
    }
  }

  const referralQuery = await adminDb
    .collection("referrals")
    .where("referralCode", "==", referralCode)
    .limit(1)
    .get()
  if (referralQuery.empty) return null

  const referrerId = referralQuery.docs[0].id
  const referrerUserSnap = await adminDb.collection("users").doc(referrerId).get()
  const referrerUser = referrerUserSnap.data() || {}
  return {
    userId: referrerId,
    displayName: String(referrerUser.displayName || "User"),
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      mobileNumber?: string
      referralCode?: string
      currentUserId?: string
    }

    const mobileNumber = normalizeMobile(body.mobileNumber || "")
    const referralCode = normalizeReferralCode(body.referralCode || "")
    const currentUserId = String(body.currentUserId || "").trim()

    if (!mobileNumber || !referralCode) {
      return NextResponse.json(
        { error: "Mobile number and referral code are required." },
        { status: 400 }
      )
    }

    const mobileValid = isValidIndianMobile(mobileNumber)
    if (!mobileValid) {
      return NextResponse.json({
        mobileValid: false,
        mobileExists: false,
        referralValid: false,
        referrerName: "",
        referrerUserId: "",
        normalizedMobile: mobileNumber,
        normalizedReferralCode: referralCode,
      })
    }

    const [mobileSnap, mobileUserQuery, legacyPhoneQuery, referrer] = await Promise.all([
      adminDb.collection("mobileNumbers").doc(mobileNumber).get(),
      adminDb.collection("users").where("mobileNumber", "==", mobileNumber).limit(1).get(),
      adminDb.collection("users").where("phone", "==", mobileNumber).limit(1).get(),
      resolveReferrer(referralCode),
    ])

    const mobileExists = mobileSnap.exists || !mobileUserQuery.empty || !legacyPhoneQuery.empty
    const referralValid = Boolean(referrer && referrer.userId && referrer.userId !== currentUserId)

    return NextResponse.json({
      mobileValid: true,
      mobileExists,
      referralValid,
      referrerName: referralValid ? String(referrer?.displayName || "") : "",
      referrerUserId: referralValid ? String(referrer?.userId || "") : "",
      normalizedMobile: mobileNumber,
      normalizedReferralCode: referralCode,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Validation failed",
      },
      { status: 500 }
    )
  }
}
