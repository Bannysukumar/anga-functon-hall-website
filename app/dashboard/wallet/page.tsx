"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getRewardsDashboardData } from "@/lib/rewards-functions"

export default function WalletPage() {
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
        setError(e instanceof Error ? e.message : "Failed to load wallet")
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])
  if (loading) return <p className="text-sm text-muted-foreground">Loading wallet...</p>
  if (!data) return <p className="text-sm text-destructive">{error || "Failed to load wallet."}</p>
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Wallet</h1>
      <Card>
        <CardHeader><CardTitle>Balance</CardTitle></CardHeader>
        <CardContent>₹{data.wallet.balance.toLocaleString("en-IN")}</CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.recentTransactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between text-sm">
              <span>{tx.description}</span>
              <span className={tx.type === "credit" ? "text-emerald-600" : "text-amber-600"}>
                {tx.type === "credit" ? "+" : "-"}₹{tx.amount}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
