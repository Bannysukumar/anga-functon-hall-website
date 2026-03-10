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
    const adminUser = await adminDb.collection("users").doc(decoded.uid).get()
    if (String(adminUser.data()?.role || "") !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const [usersSnap, bookingsSnap, walletTxSnap, referralsSnap, dailySnap, spinSnap] =
      await Promise.all([
        adminDb.collection("users").get(),
        adminDb.collection("bookings").get(),
        adminDb.collection("walletTransactions").get(),
        adminDb.collection("referrals").get(),
        adminDb.collection("dailyRewards").get(),
        adminDb.collection("spinUsage").get(),
      ])

    const totalReferralRewards = referralsSnap.docs.reduce(
      (sum, docSnap) => sum + Number(docSnap.data()?.rewardEarned || 0),
      0
    )
    const usersMap = new Map(usersSnap.docs.map((d) => [d.id, d.data()]))
    const topReferrers = referralsSnap.docs
      .map((docSnap) => ({
        userId: docSnap.id,
        successfulReferrals: Number(docSnap.data()?.successfulReferrals || 0),
      }))
      .sort((a, b) => b.successfulReferrals - a.successfulReferrals)
      .slice(0, 10)
      .map((item) => ({
        ...item,
        displayName: String(usersMap.get(item.userId)?.displayName || "User"),
      }))

    return NextResponse.json({
      ok: true,
      totalUsers: usersSnap.size,
      totalBookings: bookingsSnap.size,
      totalReferralRewards,
      walletTransactions: walletTxSnap.size,
      dailyRewardUsage: dailySnap.size,
      spinUsage: spinSnap.size,
      topReferrers,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load rewards analytics",
      },
      { status: 500 }
    )
  }
}
