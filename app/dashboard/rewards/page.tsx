"use client"

import dynamic from "next/dynamic"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/hooks/use-auth"
import {
  claimDailyReward,
  getRewardsDashboardData,
  scratchRewardCard,
  spinWheelReward,
} from "@/lib/rewards-functions"
import { useEffect } from "react"

const SpinWheel = dynamic(
  () => import("@/components/rewards/spin-wheel").then((mod) => mod.SpinWheel),
  { ssr: false }
)
const ScratchCardBoard = dynamic(
  () => import("@/components/rewards/scratch-card-board").then((mod) => mod.ScratchCardBoard),
  { ssr: false }
)

export default function RewardsCenterPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [claimingDaily, setClaimingDaily] = useState(false)
  const [data, setData] = useState<Awaited<ReturnType<typeof getRewardsDashboardData>> | null>(
    null
  )

  const referralLink = data?.referral.referralLink || ""

  async function load() {
    setLoading(true)
    try {
      const res = await getRewardsDashboardData()
      setData(res)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load rewards")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid])

  const qrUrl = useMemo(() => {
    if (!referralLink) return ""
    return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(referralLink)}`
  }, [referralLink])
  const rewardLeaderboard = useMemo(() => {
    if (!data) return []
    return data.leaderboard
      .filter((entry) => Number(entry.totalRewards || 0) > 0)
      .map((entry, index) => ({ ...entry, rank: index + 1 }))
  }, [data])

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading rewards...</div>
  }
  if (!data) return null

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Rewards Center</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Wallet Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">₹{data.wallet.balance.toLocaleString("en-IN")}</p>
            <p className="text-sm text-muted-foreground">
              Earned: ₹{data.wallet.totalEarned.toLocaleString("en-IN")} | Spent: ₹
              {data.wallet.totalSpent.toLocaleString("en-IN")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Daily Reward</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Claim every {data.dailyReward.claimIntervalHours}h
            </p>
            <Button
              disabled={!data.dailyReward.canClaim || claimingDaily}
              onClick={async () => {
                setClaimingDaily(true)
                try {
                  const res = await claimDailyReward()
                  toast.success(`₹${res.amount} added to wallet`)
                  await load()
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Claim failed")
                } finally {
                  setClaimingDaily(false)
                }
              }}
            >
              {data.dailyReward.canClaim ? "Claim now" : "Not available"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Referral Rewards</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Total referrals: {data.referral.totalReferrals}</p>
            <p>Pending referrals: {data.referral.pendingReferrals}</p>
            <p>Successful referrals: {data.referral.successfulReferrals}</p>
            <p className="font-medium">
              Rewards earned: ₹{data.referral.rewardEarned.toLocaleString("en-IN")}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Referral Sharing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">Code: <span className="font-semibold">{data.referral.referralCode}</span></p>
          <div className="flex gap-2">
            <Input value={referralLink} readOnly />
            <Button
              onClick={async () => {
                await navigator.clipboard.writeText(referralLink)
                toast.success("Referral link copied")
              }}
            >
              Copy Link
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <a href={`https://wa.me/?text=${encodeURIComponent(referralLink)}`} target="_blank">
                WhatsApp
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}`} target="_blank">
                Telegram
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`}
                target="_blank"
              >
                Facebook
              </a>
            </Button>
          </div>
          {qrUrl ? <img src={qrUrl} alt="Referral QR" className="h-40 w-40 rounded border" /> : null}
          <p className="text-xs text-muted-foreground">
            Total: {data.referral.totalReferrals}, Pending: {data.referral.pendingReferrals}, Successful:{" "}
            {data.referral.successfulReferrals}
          </p>
        </CardContent>
      </Card>

      <SpinWheel
        enabled={data.spin.enabled}
        spinsLeftToday={data.spin.spinsLeftToday}
        maxSpinsPerDay={data.spin.maxSpinsPerDay}
        onSpinRequest={async () => {
          const res = await spinWheelReward()
          return res
        }}
        onResultApplied={(result) => {
          setData((current) =>
            current
              ? {
                  ...current,
                  wallet: {
                    ...current.wallet,
                    balance: result.rewardType === "money" ? result.balance : current.wallet.balance,
                  },
                  spin: {
                    ...current.spin,
                    spinsLeftToday: Math.max(0, current.spin.spinsLeftToday - 1),
                  },
                }
              : current
          )
          load()
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Scratch Cards</CardTitle>
        </CardHeader>
        <CardContent>
          <ScratchCardBoard
            cards={data.scratchCards}
            onCollect={async (cardId) => {
              const reward = await scratchRewardCard(cardId)
              toast.success(`You won ₹${reward.amount}`)
              return reward
            }}
            onCollected={(cardId, reward) => {
              setData((current) =>
                current
                  ? {
                      ...current,
                      wallet: { ...current.wallet, balance: reward.balance },
                      scratchCards: current.scratchCards.map((card) =>
                        card.id === cardId
                          ? { ...card, status: "scratched", rewardAmount: reward.amount }
                          : card
                      ),
                    }
                  : current
              )
              load()
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rewardLeaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground">Leaderboard data is not available yet.</p>
          ) : (
            rewardLeaderboard.map((entry) => (
              <div
                key={entry.userId}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <p>
                  #{entry.rank} {entry.displayName}
                </p>
                <p>
                  {entry.successfulReferrals} referrals • ₹
                  {entry.totalRewards.toLocaleString("en-IN")}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
