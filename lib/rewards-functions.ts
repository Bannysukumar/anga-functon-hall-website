export type RewardsDashboardResponse = {
  wallet: {
    balance: number
    totalEarned: number
    totalSpent: number
  }
  referral: {
    referralCode: string
    referralLink: string
    totalReferrals: number
    pendingReferrals: number
    successfulReferrals: number
    rewardEarned: number
  }
  scratchCards: Array<{
    id: string
    status: "locked" | "available" | "scratched"
    rewardAmount: number | null
    createdAt: number
  }>
  recentTransactions: Array<{
    id: string
    amount: number
    type: "credit" | "debit"
    source: string
    description: string
    createdAt: number
  }>
  dailyReward: {
    enabled: boolean
    claimIntervalHours: number
    canClaim: boolean
    nextClaimAt: number | null
  }
  spin: {
    enabled: boolean
    spinsLeftToday: number
    maxSpinsPerDay: number
  }
  leaderboard: Array<{
    rank: number
    userId: string
    displayName: string
    successfulReferrals: number
    totalRewards: number
  }>
}

export async function getRewardsDashboardData() {
  const { auth: firebaseAuth } = await import("@/lib/firebase")
  const currentUser = firebaseAuth.currentUser
  if (!currentUser) {
    throw new Error("Please login first.")
  }
  const idToken = await currentUser.getIdToken()
  const response = await fetch("/api/rewards/dashboard", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  })
  const payload = (await response.json()) as RewardsDashboardResponse & { error?: string }
  if (!response.ok) {
    throw new Error(payload.error || "Failed to load rewards dashboard")
  }
  return payload
}

export async function claimDailyReward() {
  const { auth: firebaseAuth } = await import("@/lib/firebase")
  const currentUser = firebaseAuth.currentUser
  if (!currentUser) throw new Error("Please login first.")
  const idToken = await currentUser.getIdToken()
  const response = await fetch("/api/rewards/claim-daily", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
  })
  const payload = (await response.json()) as { ok?: boolean; amount?: number; balance?: number; error?: string }
  if (!response.ok) throw new Error(payload.error || "Claim failed")
  return { ok: Boolean(payload.ok), amount: Number(payload.amount || 0), balance: Number(payload.balance || 0) }
}

export async function spinWheelReward() {
  const { auth: firebaseAuth } = await import("@/lib/firebase")
  const currentUser = firebaseAuth.currentUser
  if (!currentUser) throw new Error("Please login first.")
  const idToken = await currentUser.getIdToken()
  const response = await fetch("/api/rewards/spin", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
  })
  const payload = (await response.json()) as {
    ok?: boolean
    rewardType?: "money" | "scratch_card" | "discount" | "none"
    label?: string
    amount?: number
    balance?: number
    error?: string
  }
  if (!response.ok) throw new Error(payload.error || "Spin failed")
  return {
    ok: Boolean(payload.ok),
    rewardType: payload.rewardType || "none",
    label: String(payload.label || ""),
    amount: Number(payload.amount || 0),
    balance: Number(payload.balance || 0),
  }
}

export async function scratchRewardCard(cardId: string) {
  const { auth: firebaseAuth } = await import("@/lib/firebase")
  const currentUser = firebaseAuth.currentUser
  if (!currentUser) throw new Error("Please login first.")
  const idToken = await currentUser.getIdToken()
  const response = await fetch("/api/rewards/scratch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cardId }),
  })
  const payload = (await response.json()) as { ok?: boolean; amount?: number; balance?: number; error?: string }
  if (!response.ok) throw new Error(payload.error || "Scratch failed")
  return { ok: Boolean(payload.ok), amount: Number(payload.amount || 0), balance: Number(payload.balance || 0) }
}

export async function adminUpdateRewardsConfig(payload: Record<string, unknown>) {
  const { auth: firebaseAuth } = await import("@/lib/firebase")
  const currentUser = firebaseAuth.currentUser
  if (!currentUser) throw new Error("Please login first.")
  const idToken = await currentUser.getIdToken()
  const response = await fetch("/api/admin/rewards-config", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  })
  const data = (await response.json()) as { ok?: boolean; error?: string }
  if (!response.ok) throw new Error(data.error || "Update failed")
  return { ok: Boolean(data.ok) }
}

export async function adminAdjustWallet(payload: {
  targetUserId: string
  amount: number
  reason: string
}) {
  const { auth: firebaseAuth } = await import("@/lib/firebase")
  const currentUser = firebaseAuth.currentUser
  if (!currentUser) throw new Error("Please login first.")
  const idToken = await currentUser.getIdToken()
  const response = await fetch("/api/admin/wallet-adjustment", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  const data = (await response.json()) as { ok?: boolean; error?: string }
  if (!response.ok) throw new Error(data.error || "Wallet adjustment failed")
  return { ok: Boolean(data.ok) }
}

export async function adminBackfillReferralCodes(payload?: {
  limit?: number
  startAfterUserId?: string
}) {
  const { auth: firebaseAuth } = await import("@/lib/firebase")
  const currentUser = firebaseAuth.currentUser
  if (!currentUser) throw new Error("Please login first.")
  const idToken = await currentUser.getIdToken()
  const response = await fetch("/api/admin/referral-backfill", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload || {}),
  })
  const data = (await response.json()) as {
    ok?: boolean
    processed?: number
    created?: number
    updatedMissingCode?: number
    walletCreated?: number
    hasMore?: boolean
    nextCursor?: string
    error?: string
  }
  if (!response.ok) throw new Error(data.error || "Backfill failed")
  return {
    ok: Boolean(data.ok),
    processed: Number(data.processed || 0),
    created: Number(data.created || 0),
    updatedMissingCode: Number(data.updatedMissingCode || 0),
    walletCreated: Number(data.walletCreated || 0),
    hasMore: Boolean(data.hasMore),
    nextCursor: String(data.nextCursor || ""),
  }
}

export async function adminRewardsAnalytics() {
  const { auth: firebaseAuth } = await import("@/lib/firebase")
  const currentUser = firebaseAuth.currentUser
  if (!currentUser) {
    throw new Error("Please login first.")
  }
  const idToken = await currentUser.getIdToken()
  const response = await fetch("/api/admin/rewards-analytics", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  })
  const payload = (await response.json()) as {
    ok?: boolean
    error?: string
    totalUsers: number
    totalBookings: number
    totalReferralRewards: number
    walletTransactions: number
    dailyRewardUsage: number
    spinUsage: number
    topReferrers: Array<{ userId: string; displayName: string; successfulReferrals: number }>
  }
  if (!response.ok) {
    throw new Error(payload.error || "Failed to fetch analytics")
  }
  return {
    ok: Boolean(payload.ok),
    totalUsers: Number(payload.totalUsers || 0),
    totalBookings: Number(payload.totalBookings || 0),
    totalReferralRewards: Number(payload.totalReferralRewards || 0),
    walletTransactions: Number(payload.walletTransactions || 0),
    dailyRewardUsage: Number(payload.dailyRewardUsage || 0),
    spinUsage: Number(payload.spinUsage || 0),
    topReferrers: payload.topReferrers || [],
  }
}
