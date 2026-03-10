import { NextResponse } from "next/server"
import { adminAuth, adminDb } from "@/lib/server/firebase-admin"
import { FieldValue } from "firebase-admin/firestore"

function readBearerToken(request: Request): string {
  const authHeader = request.headers.get("authorization") || ""
  if (!authHeader.startsWith("Bearer ")) return ""
  return authHeader.slice("Bearer ".length).trim()
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
    const body = (await request.json()) as {
      targetUserId?: string
      amount?: number
      reason?: string
    }
    const targetUserId = String(body.targetUserId || "").trim()
    const amount = Number(body.amount || 0)
    const reason = String(body.reason || "").trim()
    if (!targetUserId || !Number.isFinite(amount) || amount === 0 || !reason) {
      return NextResponse.json(
        { error: "targetUserId, amount and reason are required." },
        { status: 400 }
      )
    }

    await adminDb.runTransaction(async (transaction) => {
      const walletRef = adminDb.collection("userWallets").doc(targetUserId)
      const walletSnap = await transaction.get(walletRef)
      const currentBalance = Number(walletSnap.data()?.balance || 0)
      const absAmount = Math.abs(amount)
      const isCredit = amount > 0
      const nextBalance = isCredit ? currentBalance + absAmount : currentBalance - absAmount
      if (nextBalance < 0) {
        throw new Error("Insufficient wallet balance.")
      }
      transaction.set(
        walletRef,
        {
          userId: targetUserId,
          balance: nextBalance,
          totalEarned: Number(walletSnap.data()?.totalEarned || 0) + (isCredit ? absAmount : 0),
          totalSpent: Number(walletSnap.data()?.totalSpent || 0) + (!isCredit ? absAmount : 0),
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: walletSnap.data()?.createdAt || FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      transaction.set(adminDb.collection("walletTransactions").doc(), {
        userId: targetUserId,
        amount: absAmount,
        type: isCredit ? "credit" : "debit",
        source: "admin_adjustment",
        description: reason,
        referenceId: `admin_${Date.now()}`,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: decoded.uid,
      })
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Wallet adjustment failed" },
      { status: 500 }
    )
  }
}
