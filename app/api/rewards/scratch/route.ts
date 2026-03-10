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
    const body = (await request.json()) as { cardId?: string }
    const cardId = String(body.cardId || "")
    if (!cardId) return NextResponse.json({ error: "cardId is required" }, { status: 400 })
    const rewardsSnap = await adminDb.collection("settings").doc("rewards").get()
    const rewards = (rewardsSnap.data() || {}) as Record<string, any>
    const list = Array.isArray(rewards.scratchCard?.rewards)
      ? rewards.scratchCard.rewards
      : [{ value: 1, weight: 1 }]
    const amount = pickWeightedValue(list)
    let balance = 0
    await adminDb.runTransaction(async (transaction) => {
      const cardRef = adminDb.collection("scratchCards").doc(cardId)
      const walletRef = adminDb.collection("userWallets").doc(uid)
      const [cardSnap, walletSnap] = await Promise.all([
        transaction.get(cardRef),
        transaction.get(walletRef),
      ])
      if (!cardSnap.exists) throw new Error("Scratch card not found.")
      const card = cardSnap.data() || {}
      if (String(card.userId || "") !== uid) throw new Error("Not allowed.")
      if (String(card.status || "") === "scratched") throw new Error("Card already used.")
      const currentBalance = Number(walletSnap.data()?.balance || 0)
      balance = currentBalance + amount
      transaction.set(
        cardRef,
        {
          status: "scratched",
          rewardAmount: amount,
          scratchedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
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
        source: "scratch_card",
        description: "Scratch card reward",
        referenceId: cardId,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: uid,
      })
    })
    return NextResponse.json({ ok: true, amount, balance })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scratch failed"
    const knownError =
      message === "Scratch card not found." ||
      message === "Not allowed." ||
      message === "Card already used."
    return NextResponse.json(
      { error: message },
      { status: knownError ? 400 : 500 }
    )
  }
}
