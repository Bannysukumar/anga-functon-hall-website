"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getRewardsDashboardData } from "@/lib/rewards-functions"

export default function ReferralLeaderboardPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getRewardsDashboardData>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError("")
      try {
        const res = await getRewardsDashboardData()
        setData(res)
      } catch (e) {
        setData(null)
        setError(e instanceof Error ? e.message : "Failed to load leaderboard")
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])
  if (loading) return <p className="text-sm text-muted-foreground">Loading leaderboard...</p>
  if (!data) return <p className="text-sm text-destructive">{error || "Failed to load leaderboard."}</p>
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Referral Leaderboard</h1>
      <Card>
        <CardHeader><CardTitle>Top Referrers</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.leaderboard.map((item) => (
            <div key={item.userId} className="flex items-center justify-between text-sm">
              <span>#{item.rank} {item.displayName}</span>
              <span>{item.successfulReferrals} successful | ₹{item.totalRewards}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
