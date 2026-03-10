"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { getRewardsDashboardData, scratchRewardCard } from "@/lib/rewards-functions"

const ScratchCardBoard = dynamic(
  () => import("@/components/rewards/scratch-card-board").then((mod) => mod.ScratchCardBoard),
  { ssr: false }
)

export default function ScratchCardsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getRewardsDashboardData>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await getRewardsDashboardData()
      setData(res)
    } catch (e) {
      setData(null)
      setError(e instanceof Error ? e.message : "Failed to load scratch cards")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])
  if (loading) return <p className="text-sm text-muted-foreground">Loading scratch cards...</p>
  if (!data) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">{error || "Failed to load scratch cards."}</p>
        <Button variant="outline" onClick={load}>Retry</Button>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Scratch Cards</h1>
      <ScratchCardBoard
        cards={data.scratchCards}
        onCollect={async (cardId) => {
          try {
            const reward = await scratchRewardCard(cardId)
            toast.success(`Reward ₹${reward.amount} credited`)
            return reward
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Scratch failed")
            throw error
          }
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
    </div>
  )
}
