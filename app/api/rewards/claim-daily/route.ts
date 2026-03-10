import { NextResponse } from "next/server"
import { adminAuth, adminDb } from "@/lib/server/firebase-admin"
import { FieldValue } from "firebase-admin/firestore"

function readBearerToken(request: Request): string {
  const authHeader = request.headers.get("authorization") || ""
  if (!authHeader.startsWith("Bearer ")) return ""
  return authHeader.slice("Bearer ".length).trim()
}

function pickWeightedValue(items: Array<{ value: number; weight: number }>): number {
  const normalized = items
    .map((item) => ({
      value: Number(item.value || 0),
      weight: Math.max(0, Number(item.weight || 0)),
    }))
    .filter((item) => item.weight > 0)
  if (normalized.length === 0) return 0
  const total = normalized.reduce((sum, item) => sum + item.weight, 0)
  const random = Math.random() * total
  let cursor = 0
  for (const item of normalized) {
    cursor += item.weight
    if (random <= cursor) return item.value
  }
  return normalized[normalized.length - 1].value
}

export async function POST(request: Request) {
  try {
    const idToken = readBearerToken(request)
    if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const decoded = await adminAuth.verifyIdToken(idToken)
    const uid = decoded.uid
    const rewardsSnap = await adminDb.collection("settings").doc("rewards").get()
    const rewards = (rewardsSnap.data() || {}) as Record<string, any>
    const daily = rewards.dailyReward || {}
    const enabled = Boolean(daily.enabled ?? true)
    const claimIntervalHours = Number(daily.claimIntervalHours || 24)
    const rewardsList = Array.isArray(daily.rewards) ? daily.rewards : [{ value: 1, weight: 1 }]
    if (!enabled) {
      return NextResponse.json({ error: "Daily reward is disabled." }, { status: 400 })
    }
    const amount = pickWeightedValue(rewardsList)
    let balance = 0
    await adminDb.runTransaction(async (transaction) => {
      const dailyRef = adminDb.collection("dailyRewards").doc(uid)
      const walletRef = adminDb.collection("userWallets").doc(uid)
      const [dailySnap, walletSnap] = await Promise.all([
        transaction.get(dailyRef),
        transaction.get(walletRef),
      ])
      const lastClaim = Number(dailySnap.data()?.lastClaimAt?.toMillis?.() || 0)
      const minNext = lastClaim + claimIntervalHours * 60 * 60 * 1000
      if (lastClaim > 0 && Date.now() < minNext) {
        throw new Error("Daily reward is not ready yet.")
      }
      const currentBalance = Number(walletSnap.data()?.balance || 0)
      balance = currentBalance + amount
      transaction.set(
        walletRef,
        {
          userId: uid,
          balance,
          totalEarned: Number(walletSnap.data()?.totalEarned || 0) + amount,
          totalSpent: Number(walletSnap.data()?.totalSpent || 0),
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: walletSnap.data()?.createdAt || FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      transaction.set(adminDb.collection("walletTransactions").doc(), {
        userId: uid,
        amount,
        type: "credit",
        source: "daily_login",
        description: "Daily login reward",
        referenceId: `daily_${Date.now()}`,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: uid,
      })
      transaction.set(
        dailyRef,
        {
          userId: uid,
          lastClaimAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    })
    return NextResponse.json({ ok: true, amount, balance })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Claim failed" },
      { status: 500 }
    )
  }
}
