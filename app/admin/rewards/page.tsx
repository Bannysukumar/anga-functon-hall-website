"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  adminAdjustWallet,
  adminBackfillReferralCodes,
  adminRewardsAnalytics,
  adminUpdateRewardsConfig,
} from "@/lib/rewards-functions"
import { db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"

type WeightedAmount = { value: number; weight: number }
type SpinReward = {
  label: string
  type: "money" | "none" | "discount" | "scratch_card"
  value: number
  weight: number
}
type RewardsConfig = {
  referral: {
    enabled: boolean
    maxReferralsPerDay: number
  }
  scratchCard: {
    rewards: WeightedAmount[]
  }
  dailyReward: {
    enabled: boolean
    claimIntervalHours: number
    rewards: WeightedAmount[]
  }
  spinWheel: {
    enabled: boolean
    maxSpinsPerDay: number
    rewards: SpinReward[]
  }
  leaderboardBonusRewards: number[]
}

const DEFAULT_CONFIG: RewardsConfig = {
  referral: { enabled: true, maxReferralsPerDay: 20 },
  scratchCard: {
    rewards: [
      { value: 1, weight: 40 },
      { value: 5, weight: 25 },
      { value: 10, weight: 20 },
      { value: 20, weight: 10 },
      { value: 50, weight: 4 },
      { value: 100, weight: 1 },
    ],
  },
  dailyReward: {
    enabled: true,
    claimIntervalHours: 24,
    rewards: [
      { value: 1, weight: 50 },
      { value: 2, weight: 30 },
      { value: 5, weight: 15 },
      { value: 10, weight: 5 },
    ],
  },
  spinWheel: {
    enabled: true,
    maxSpinsPerDay: 1,
    rewards: [
      { label: "₹1", type: "money", value: 1, weight: 30 },
      { label: "₹2", type: "money", value: 2, weight: 20 },
      { label: "₹5", type: "money", value: 5, weight: 15 },
      { label: "₹10", type: "money", value: 10, weight: 10 },
      { label: "₹20", type: "money", value: 20, weight: 5 },
      { label: "Better luck next time", type: "none", value: 0, weight: 15 },
      { label: "Extra scratch card", type: "scratch_card", value: 0, weight: 5 },
    ],
  },
  leaderboardBonusRewards: [500, 300, 100],
}

function normalizeConfig(raw: Partial<RewardsConfig> | null | undefined): RewardsConfig {
  return {
    referral: {
      enabled: raw?.referral?.enabled ?? DEFAULT_CONFIG.referral.enabled,
      maxReferralsPerDay: Number(raw?.referral?.maxReferralsPerDay || DEFAULT_CONFIG.referral.maxReferralsPerDay),
    },
    scratchCard: {
      rewards: Array.isArray(raw?.scratchCard?.rewards) && raw?.scratchCard?.rewards.length > 0
        ? raw.scratchCard.rewards.map((r) => ({ value: Number(r.value || 0), weight: Number(r.weight || 0) }))
        : DEFAULT_CONFIG.scratchCard.rewards,
    },
    dailyReward: {
      enabled: raw?.dailyReward?.enabled ?? DEFAULT_CONFIG.dailyReward.enabled,
      claimIntervalHours: Number(raw?.dailyReward?.claimIntervalHours || DEFAULT_CONFIG.dailyReward.claimIntervalHours),
      rewards: Array.isArray(raw?.dailyReward?.rewards) && raw?.dailyReward?.rewards.length > 0
        ? raw.dailyReward.rewards.map((r) => ({ value: Number(r.value || 0), weight: Number(r.weight || 0) }))
        : DEFAULT_CONFIG.dailyReward.rewards,
    },
    spinWheel: {
      enabled: raw?.spinWheel?.enabled ?? DEFAULT_CONFIG.spinWheel.enabled,
      maxSpinsPerDay: Number(raw?.spinWheel?.maxSpinsPerDay || DEFAULT_CONFIG.spinWheel.maxSpinsPerDay),
      rewards: Array.isArray(raw?.spinWheel?.rewards) && raw?.spinWheel?.rewards.length > 0
        ? raw.spinWheel.rewards.map((r) => ({
            label: String(r.label || ""),
            type: (r.type || "none") as SpinReward["type"],
            value: Number(r.value || 0),
            weight: Number(r.weight || 0),
          }))
        : DEFAULT_CONFIG.spinWheel.rewards,
    },
    leaderboardBonusRewards:
      Array.isArray(raw?.leaderboardBonusRewards) && raw?.leaderboardBonusRewards.length > 0
        ? raw.leaderboardBonusRewards.map((v) => Number(v || 0))
        : DEFAULT_CONFIG.leaderboardBonusRewards,
  }
}

function weightPercent(weight: number, total: number) {
  if (total <= 0) return "0.00%"
  return `${((weight / total) * 100).toFixed(2)}%`
}

export default function AdminRewardsPage() {
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<Awaited<ReturnType<typeof adminRewardsAnalytics>> | null>(null)
  const [config, setConfig] = useState<RewardsConfig>(DEFAULT_CONFIG)
  const [targetUserId, setTargetUserId] = useState("")
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [backfilling, setBackfilling] = useState(false)
  const [backfillSummary, setBackfillSummary] = useState("")

  async function load() {
    setLoading(true)
    try {
      const data = await adminRewardsAnalytics()
      setAnalytics(data)
      const settingsSnap = await getDoc(doc(db, "settings", "rewards"))
      setConfig(normalizeConfig((settingsSnap.data() || {}) as Partial<RewardsConfig>))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load analytics")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const scratchTotal = config.scratchCard.rewards.reduce((sum, item) => sum + Math.max(0, item.weight), 0)
  const dailyTotal = config.dailyReward.rewards.reduce((sum, item) => sum + Math.max(0, item.weight), 0)
  const spinTotal = config.spinWheel.rewards.reduce((sum, item) => sum + Math.max(0, item.weight), 0)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Rewards Admin</h1>
      {loading || !analytics ? (
        <p className="text-sm text-muted-foreground">Loading analytics...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader><CardTitle>Total Referral Rewards</CardTitle></CardHeader><CardContent>₹{analytics.totalReferralRewards.toLocaleString("en-IN")}</CardContent></Card>
          <Card><CardHeader><CardTitle>Wallet Transactions</CardTitle></CardHeader><CardContent>{analytics.walletTransactions}</CardContent></Card>
          <Card><CardHeader><CardTitle>Daily / Spin Usage</CardTitle></CardHeader><CardContent>{analytics.dailyRewardUsage} / {analytics.spinUsage}</CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Rewards Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3 rounded border p-4">
            <div className="flex items-center justify-between">
              <Label>Referral Program</Label>
              <Switch
                checked={config.referral.enabled}
                onCheckedChange={(checked) =>
                  setConfig((prev) => ({ ...prev, referral: { ...prev.referral, enabled: checked } }))
                }
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Max Successful Referrals / Day</Label>
                <Input
                  type="number"
                  value={config.referral.maxReferralsPerDay}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      referral: { ...prev.referral, maxReferralsPerDay: Number(e.target.value || 0) },
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded border p-4">
            <Label>Scratch Card Rewards (Value + Weight)</Label>
            {config.scratchCard.rewards.map((reward, index) => (
              <div key={`scratch-${index}`} className="grid grid-cols-12 gap-2">
                <Input
                  className="col-span-4"
                  type="number"
                  value={reward.value}
                  onChange={(e) =>
                    setConfig((prev) => {
                      const rewards = [...prev.scratchCard.rewards]
                      rewards[index] = { ...rewards[index], value: Number(e.target.value || 0) }
                      return { ...prev, scratchCard: { ...prev.scratchCard, rewards } }
                    })
                  }
                />
                <Input
                  className="col-span-4"
                  type="number"
                  value={reward.weight}
                  onChange={(e) =>
                    setConfig((prev) => {
                      const rewards = [...prev.scratchCard.rewards]
                      rewards[index] = { ...rewards[index], weight: Number(e.target.value || 0) }
                      return { ...prev, scratchCard: { ...prev.scratchCard, rewards } }
                    })
                  }
                />
                <Input
                  className="col-span-3"
                  value={weightPercent(reward.weight, scratchTotal)}
                  readOnly
                />
                <Button
                  className="col-span-1"
                  variant="destructive"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      scratchCard: {
                        ...prev.scratchCard,
                        rewards: prev.scratchCard.rewards.filter((_, i) => i !== index),
                      },
                    }))
                  }
                >
                  -
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() =>
                setConfig((prev) => ({
                  ...prev,
                  scratchCard: {
                    ...prev.scratchCard,
                    rewards: [...prev.scratchCard.rewards, { value: 0, weight: 0 }],
                  },
                }))
              }
            >
              Add Scratch Reward
            </Button>
          </div>

          <div className="space-y-3 rounded border p-4">
            <div className="flex items-center justify-between">
              <Label>Daily Reward</Label>
              <Switch
                checked={config.dailyReward.enabled}
                onCheckedChange={(checked) =>
                  setConfig((prev) => ({ ...prev, dailyReward: { ...prev.dailyReward, enabled: checked } }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Claim Interval (Hours)</Label>
              <Input
                type="number"
                value={config.dailyReward.claimIntervalHours}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    dailyReward: { ...prev.dailyReward, claimIntervalHours: Number(e.target.value || 24) },
                  }))
                }
              />
            </div>
            {config.dailyReward.rewards.map((reward, index) => (
              <div key={`daily-${index}`} className="grid grid-cols-12 gap-2">
                <Input
                  className="col-span-4"
                  type="number"
                  value={reward.value}
                  onChange={(e) =>
                    setConfig((prev) => {
                      const rewards = [...prev.dailyReward.rewards]
                      rewards[index] = { ...rewards[index], value: Number(e.target.value || 0) }
                      return { ...prev, dailyReward: { ...prev.dailyReward, rewards } }
                    })
                  }
                />
                <Input
                  className="col-span-4"
                  type="number"
                  value={reward.weight}
                  onChange={(e) =>
                    setConfig((prev) => {
                      const rewards = [...prev.dailyReward.rewards]
                      rewards[index] = { ...rewards[index], weight: Number(e.target.value || 0) }
                      return { ...prev, dailyReward: { ...prev.dailyReward, rewards } }
                    })
                  }
                />
                <Input className="col-span-3" value={weightPercent(reward.weight, dailyTotal)} readOnly />
                <Button
                  className="col-span-1"
                  variant="destructive"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      dailyReward: {
                        ...prev.dailyReward,
                        rewards: prev.dailyReward.rewards.filter((_, i) => i !== index),
                      },
                    }))
                  }
                >
                  -
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() =>
                setConfig((prev) => ({
                  ...prev,
                  dailyReward: {
                    ...prev.dailyReward,
                    rewards: [...prev.dailyReward.rewards, { value: 0, weight: 0 }],
                  },
                }))
              }
            >
              Add Daily Reward
            </Button>
          </div>

          <div className="space-y-3 rounded border p-4">
            <div className="flex items-center justify-between">
              <Label>Spin Wheel</Label>
              <Switch
                checked={config.spinWheel.enabled}
                onCheckedChange={(checked) =>
                  setConfig((prev) => ({ ...prev, spinWheel: { ...prev.spinWheel, enabled: checked } }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Max Spins / Day</Label>
              <Input
                type="number"
                value={config.spinWheel.maxSpinsPerDay}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    spinWheel: { ...prev.spinWheel, maxSpinsPerDay: Number(e.target.value || 1) },
                  }))
                }
              />
            </div>
            {config.spinWheel.rewards.map((reward, index) => (
              <div key={`spin-${index}`} className="grid grid-cols-12 gap-2">
                <Input
                  className="col-span-3"
                  value={reward.label}
                  onChange={(e) =>
                    setConfig((prev) => {
                      const rewards = [...prev.spinWheel.rewards]
                      rewards[index] = { ...rewards[index], label: e.target.value }
                      return { ...prev, spinWheel: { ...prev.spinWheel, rewards } }
                    })
                  }
                />
                <select
                  className="col-span-3 rounded border px-2 text-sm"
                  value={reward.type}
                  onChange={(e) =>
                    setConfig((prev) => {
                      const rewards = [...prev.spinWheel.rewards]
                      rewards[index] = { ...rewards[index], type: e.target.value as SpinReward["type"] }
                      return { ...prev, spinWheel: { ...prev.spinWheel, rewards } }
                    })
                  }
                >
                  <option value="money">money</option>
                  <option value="none">none</option>
                  <option value="discount">discount</option>
                  <option value="scratch_card">scratch_card</option>
                </select>
                <Input
                  className="col-span-2"
                  type="number"
                  value={reward.value}
                  onChange={(e) =>
                    setConfig((prev) => {
                      const rewards = [...prev.spinWheel.rewards]
                      rewards[index] = { ...rewards[index], value: Number(e.target.value || 0) }
                      return { ...prev, spinWheel: { ...prev.spinWheel, rewards } }
                    })
                  }
                />
                <Input
                  className="col-span-2"
                  type="number"
                  value={reward.weight}
                  onChange={(e) =>
                    setConfig((prev) => {
                      const rewards = [...prev.spinWheel.rewards]
                      rewards[index] = { ...rewards[index], weight: Number(e.target.value || 0) }
                      return { ...prev, spinWheel: { ...prev.spinWheel, rewards } }
                    })
                  }
                />
                <Input className="col-span-1" value={weightPercent(reward.weight, spinTotal)} readOnly />
                <Button
                  className="col-span-1"
                  variant="destructive"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      spinWheel: {
                        ...prev.spinWheel,
                        rewards: prev.spinWheel.rewards.filter((_, i) => i !== index),
                      },
                    }))
                  }
                >
                  -
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() =>
                setConfig((prev) => ({
                  ...prev,
                  spinWheel: {
                    ...prev.spinWheel,
                    rewards: [
                      ...prev.spinWheel.rewards,
                      { label: "New Reward", type: "none", value: 0, weight: 0 },
                    ],
                  },
                }))
              }
            >
              Add Spin Reward
            </Button>
          </div>

          <div className="space-y-3 rounded border p-4">
            <Label>Leaderboard Monthly Bonuses (Top ranks)</Label>
            <div className="grid gap-2 md:grid-cols-3">
              {[0, 1, 2].map((idx) => (
                <div key={`lb-${idx}`} className="space-y-1">
                  <Label>Rank {idx + 1}</Label>
                  <Input
                    type="number"
                    value={config.leaderboardBonusRewards[idx] ?? 0}
                    onChange={(e) =>
                      setConfig((prev) => {
                        const next = [...prev.leaderboardBonusRewards]
                        next[idx] = Number(e.target.value || 0)
                        return { ...prev, leaderboardBonusRewards: next }
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={async () => {
              try {
                const payload = {
                  referral: config.referral,
                  scratchCard: config.scratchCard,
                  dailyReward: config.dailyReward,
                  spinWheel: config.spinWheel,
                  leaderboardBonusRewards: config.leaderboardBonusRewards,
                }
                await adminUpdateRewardsConfig(payload)
                toast.success("Rewards settings updated")
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to save settings")
              }
            }}
          >
            Save Rewards Settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Wallet Adjustment</CardTitle></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-4">
          <Input placeholder="User UID" value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} />
          <Input placeholder="Amount (+/-)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button
            onClick={async () => {
              try {
                await adminAdjustWallet({ targetUserId, amount: Number(amount), reason })
                toast.success("Wallet adjusted")
                setTargetUserId("")
                setAmount("")
                setReason("")
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Adjustment failed")
              }
            }}
          >
            Apply
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Referral Backfill (Old Users)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Generates referral code + wallet document for existing users who do not have one.
          </p>
          <Button
            disabled={backfilling}
            onClick={async () => {
              setBackfilling(true)
              setBackfillSummary("")
              try {
                let cursor = ""
                let rounds = 0
                let totalProcessed = 0
                let totalCreated = 0
                let totalUpdatedMissingCode = 0
                let totalWalletCreated = 0
                while (rounds < 50) {
                  const res = await adminBackfillReferralCodes({
                    limit: 150,
                    startAfterUserId: cursor,
                  })
                  totalProcessed += res.processed
                  totalCreated += res.created
                  totalUpdatedMissingCode += res.updatedMissingCode
                  totalWalletCreated += res.walletCreated
                  rounds += 1
                  if (!res.hasMore || !res.nextCursor) break
                  cursor = res.nextCursor
                }
                setBackfillSummary(
                  `Processed ${totalProcessed} users | New referrals ${totalCreated} | Missing code fixed ${totalUpdatedMissingCode} | Wallets created ${totalWalletCreated}`
                )
                toast.success("Referral backfill completed")
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Backfill failed")
              } finally {
                setBackfilling(false)
              }
            }}
          >
            {backfilling ? "Backfilling..." : "Run Backfill for Old Users"}
          </Button>
          {backfillSummary ? <p className="text-sm text-emerald-700">{backfillSummary}</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}
