import { NextResponse } from "next/server"
import { adminAuth, adminDb } from "@/lib/server/firebase-admin"
import { FieldPath, FieldValue } from "firebase-admin/firestore"

function readBearerToken(request: Request): string {
  const authHeader = request.headers.get("authorization") || ""
  if (!authHeader.startsWith("Bearer ")) return ""
  return authHeader.slice("Bearer ".length).trim()
}

function randomCode(prefix: string, length = 8) {
  const part = Math.random().toString(36).slice(2, 2 + length).toUpperCase()
  return `${prefix}${part}`
}

async function generateUniqueReferralCode(prefix = "ANGA") {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = randomCode(prefix)
    const existing = await adminDb
      .collection("referrals")
      .where("referralCode", "==", candidate)
      .limit(1)
      .get()
    if (existing.empty) return candidate
  }
  return `${prefix}${Date.now().toString(36).toUpperCase()}`
}

export async function POST(request: Request) {
  try {
    const idToken = readBearerToken(request)
    if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const decoded = await adminAuth.verifyIdToken(idToken)
    const adminUser = await adminDb.collection("users").doc(decoded.uid).get()
    if (String(adminUser.data()?.role || "") !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = (await request.json()) as { limit?: number; startAfterUserId?: string }
    const limit = Math.min(300, Math.max(1, Number(body.limit || 100)))
    const startAfterUserId = String(body.startAfterUserId || "").trim()
    let userQuery: FirebaseFirestore.Query = adminDb
      .collection("users")
      .orderBy(FieldPath.documentId())
      .limit(limit)
    if (startAfterUserId) userQuery = userQuery.startAfter(startAfterUserId)
    const usersSnap = await userQuery.get()

    let processed = 0
    let created = 0
    let updatedMissingCode = 0
    let walletCreated = 0

    for (const userDoc of usersSnap.docs) {
      processed += 1
      const userId = userDoc.id
      const user = userDoc.data() || {}
      const referredByCode = String(user.referredByCode || "").trim().toUpperCase()
      const referralRef = adminDb.collection("referrals").doc(userId)
      const walletRef = adminDb.collection("userWallets").doc(userId)
      const [referralSnap, walletSnap] = await Promise.all([referralRef.get(), walletRef.get()])

      if (!referralSnap.exists) {
        const referralCode = await generateUniqueReferralCode("ANGA")
        await referralRef.set({
          userId,
          referralCode,
          referredByCode: referredByCode || null,
          referredByUserId: null,
          pendingReferrals: 0,
          successfulReferrals: 0,
          totalReferrals: 0,
          rewardEarned: 0,
          lifetimeSuccessfulReferrals: 0,
          lifetimeTotalReferrals: 0,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        })
        created += 1
      } else if (!String(referralSnap.data()?.referralCode || "").trim()) {
        const referralCode = await generateUniqueReferralCode("ANGA")
        await referralRef.set(
          {
            referralCode,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
        updatedMissingCode += 1
      }

      if (!walletSnap.exists) {
        await walletRef.set({
          userId,
          balance: 0,
          totalEarned: 0,
          totalSpent: 0,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        })
        walletCreated += 1
      }
    }

    const lastDoc = usersSnap.docs[usersSnap.docs.length - 1]
    return NextResponse.json({
      ok: true,
      processed,
      created,
      updatedMissingCode,
      walletCreated,
      hasMore: usersSnap.size === limit,
      nextCursor: lastDoc ? lastDoc.id : "",
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backfill failed" },
      { status: 500 }
    )
  }
}
