import { NextResponse } from "next/server"
import { adminAuth, adminDb } from "@/lib/server/firebase-admin"
import { FieldValue } from "firebase-admin/firestore"

function readBearerToken(request: Request): string {
  const authHeader = request.headers.get("authorization") || ""
  if (!authHeader.startsWith("Bearer ")) return ""
  return authHeader.slice("Bearer ".length).trim()
}

function pickWeightedIndex(items: Array<{ weight: number }>): number {
  const normalized = items.map((item) => Math.max(0, Number(item.weight || 0)))
  const total = normalized.reduce((a, b) => a + b, 0)
  if (total <= 0) return 0
  const random = Math.random() * total
  let cursor = 0
  for (let index = 0; index < normalized.length; index += 1) {
    cursor += normalized[index]
    if (random <= cursor) return index
  }
  return normalized.length - 1
}

export async function POST(request: Request) {
  try {
    const idToken = readBearerToken(request)
    if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const decoded = await adminAuth.verifyIdToken(idToken)
    const uid = decoded.uid
    const rewardsSnap = await adminDb.collection("settings").doc("rewards").get()
    const rewards = (rewardsSnap.data() || {}) as Record<string, any>
    const spin = rewards.spinWheel || {}
    const enabled = Boolean(spin.enabled ?? true)
    const maxSpinsPerDay = Number(spin.maxSpinsPerDay || 1)
    const rewardItems = Array.isArray(spin.rewards) ? spin.rewards : [{ label: "Better luck", type: "none", value: 0, weight: 1 }]
    if (!enabled) return NextResponse.json({ error: "Spin wheel is disabled." }, { status: 400 })
    const dayKey = new Date().toISOString().slice(0, 10)
    const usageRef = adminDb.collection("spinUsage").doc(`${uid}_${dayKey}`)
    const selected = rewardItems[Math.max(0, pickWeightedIndex(rewardItems))] || {
      label: "Better luck next time",
      type: "none",
      value: 0,
    }
    let balance = 0
    const walletRef = adminDb.collection("userWallets").doc(uid)
    await adminDb.runTransaction(async (transaction) => {
      const [usageSnap, walletSnap] = await Promise.all([
        transaction.get(usageRef),
        transaction.get(walletRef),
      ])
      const count = Number(usageSnap.data()?.count || 0)
      if (count >= maxSpinsPerDay) {
        throw new Error("No spins left for today.")
      }
      const currentBalance = Number(walletSnap.data()?.balance || 0)
      balance = currentBalance

      transaction.set(
        usageRef,
        {
          userId: uid,
          day: dayKey,
          count: count + 1,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      if (String(selected.type) === "money" && Number(selected.value || 0) > 0) {
        const amount = Number(selected.value || 0)
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
          source: "spin_wheel",
          description: `Spin reward: ${String(selected.label || "")}`,
          referenceId: `spin_${dayKey}`,
          createdAt: FieldValue.serverTimestamp(),
          createdBy: uid,
        })
      } else if (String(selected.type) === "scratch_card") {
        transaction.set(adminDb.collection("scratchCards").doc(), {
          userId: uid,
          status: "available",
          rewardAmount: null,
          createdAt: FieldValue.serverTimestamp(),
          source: "spin",
        })
      }
    })
    return NextResponse.json({
      ok: true,
      rewardType: String(selected.type || "none"),
      label: String(selected.label || ""),
      amount: Number(selected.value || 0),
      balance,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Spin failed"
    const status = message === "No spins left for today." ? 400 : 500
    return NextResponse.json(
      { error: message },
      { status }
    )
  }
}
