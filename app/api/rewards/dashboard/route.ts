import { NextResponse } from "next/server"
import { adminAuth, adminDb } from "@/lib/server/firebase-admin"

function readBearerToken(request: Request): string {
  const authHeader = request.headers.get("authorization") || ""
  if (!authHeader.startsWith("Bearer ")) return ""
  return authHeader.slice("Bearer ".length).trim()
}

export async function GET(request: Request) {
  try {
    const idToken = readBearerToken(request)
    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const decoded = await adminAuth.verifyIdToken(idToken)
    const uid = decoded.uid

    const [walletSnap, referralSnap, txSnap, cardsSnap, rewardsSnap, dailySnap] =
      await Promise.all([
        adminDb.collection("userWallets").doc(uid).get(),
        adminDb.collection("referrals").doc(uid).get(),
        adminDb.collection("walletTransactions").where("userId", "==", uid).limit(20).get(),
        adminDb.collection("scratchCards").where("userId", "==", uid).limit(30).get(),
        adminDb.collection("settings").doc("rewards").get(),
        adminDb.collection("dailyRewards").doc(uid).get(),
      ])

    const dayKey = new Date().toISOString().slice(0, 10)
    const spinSnap = await adminDb.collection("spinUsage").doc(`${uid}_${dayKey}`).get()

    const rewards = (rewardsSnap.data() || {}) as Record<string, any>
    const dailyEnabled = Boolean(rewards.dailyReward?.enabled ?? true)
    const claimIntervalHours = Number(rewards.dailyReward?.claimIntervalHours || 24)
    const maxSpinsPerDay = Number(rewards.spinWheel?.maxSpinsPerDay || 1)
    const spinEnabled = Boolean(rewards.spinWheel?.enabled ?? true)

    const lastClaim = Number(dailySnap.data()?.lastClaimAt?.toMillis?.() || 0)
    const nextClaimAt = lastClaim
      ? lastClaim + claimIntervalHours * 60 * 60 * 1000
      : null

    const topReferralSnap = await adminDb
      .collection("referrals")
      .orderBy("successfulReferrals", "desc")
      .limit(10)
      .get()
    const topUsers = await Promise.all(
      topReferralSnap.docs.map((docSnap) =>
        adminDb.collection("users").doc(docSnap.id).get()
      )
    )
    const topUserMap = new Map(topUsers.map((u) => [u.id, u.data() || {}]))

    const smtpSnap = await adminDb.collection("secureSettings").doc("smtp").get()
    const appBaseUrl =
      String(smtpSnap.data()?.appBaseUrl || process.env.APP_BASE_URL || "").trim() ||
      "https://angafunctionhall.com"
    const referralCode = String(referralSnap.data()?.referralCode || "")

    return NextResponse.json({
      wallet: {
        balance: Number(walletSnap.data()?.balance || 0),
        totalEarned: Number(walletSnap.data()?.totalEarned || 0),
        totalSpent: Number(walletSnap.data()?.totalSpent || 0),
      },
      referral: {
        referralCode,
        referralLink: `${appBaseUrl}/signup?ref=${encodeURIComponent(referralCode)}`,
        totalReferrals: Number(referralSnap.data()?.totalReferrals || 0),
        pendingReferrals: Number(referralSnap.data()?.pendingReferrals || 0),
        successfulReferrals: Number(referralSnap.data()?.successfulReferrals || 0),
        rewardEarned: Number(referralSnap.data()?.rewardEarned || 0),
      },
      scratchCards: cardsSnap.docs.map((docSnap) => {
        const data = docSnap.data() || {}
        return {
          id: docSnap.id,
          status: String(data.status || "locked"),
          rewardAmount: data.rewardAmount === null ? null : Number(data.rewardAmount || 0),
          createdAt: Number(data.createdAt?.toMillis?.() || 0),
        }
      }),
      recentTransactions: txSnap.docs.map((docSnap) => {
        const data = docSnap.data() || {}
        return {
          id: docSnap.id,
          amount: Number(data.amount || 0),
          type: String(data.type || "credit"),
          source: String(data.source || ""),
          description: String(data.description || ""),
          createdAt: Number(data.createdAt?.toMillis?.() || 0),
        }
      }),
      dailyReward: {
        enabled: dailyEnabled,
        claimIntervalHours,
        canClaim: dailyEnabled && (!nextClaimAt || Date.now() >= nextClaimAt),
        nextClaimAt,
      },
      spin: {
        enabled: spinEnabled,
        spinsLeftToday: Math.max(0, maxSpinsPerDay - Number(spinSnap.data()?.count || 0)),
        maxSpinsPerDay,
      },
      leaderboard: topReferralSnap.docs.map((docSnap, index) => ({
        rank: index + 1,
        userId: docSnap.id,
        displayName: String(topUserMap.get(docSnap.id)?.displayName || "User"),
        successfulReferrals: Number(docSnap.data()?.successfulReferrals || 0),
        totalRewards: Number(docSnap.data()?.rewardEarned || 0),
      })),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load rewards dashboard.",
      },
      { status: 500 }
    )
  }
}
