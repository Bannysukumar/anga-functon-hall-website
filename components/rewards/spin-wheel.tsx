"use client"

import { useMemo, useState } from "react"
import { Gift, TicketPercent } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type SpinRewardResult = {
  rewardType: "money" | "scratch_card" | "discount" | "none"
  label: string
  amount: number
  balance: number
}

type Segment = {
  label: string
  tone: string
}

const SEGMENTS: Segment[] = [
  { label: "₹1", tone: "#f97316" },
  { label: "₹2", tone: "#f59e0b" },
  { label: "₹5", tone: "#84cc16" },
  { label: "₹10", tone: "#22c55e" },
  { label: "₹20", tone: "#0ea5e9" },
  { label: "Better Luck Next Time", tone: "#64748b" },
  { label: "Extra Scratch Card", tone: "#a855f7" },
  { label: "Discount Coupon", tone: "#ec4899" },
]

function normalizeLabel(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase()
}

function resolveWinningIndex(result: SpinRewardResult): number {
  const label = normalizeLabel(result.label)
  const exactIndex = SEGMENTS.findIndex((segment) => normalizeLabel(segment.label) === label)
  if (exactIndex >= 0) return exactIndex
  if (result.rewardType === "money") {
    const moneyIndex = SEGMENTS.findIndex(
      (segment) => normalizeLabel(segment.label) === normalizeLabel(`₹${result.amount}`)
    )
    if (moneyIndex >= 0) return moneyIndex
  }
  if (result.rewardType === "scratch_card") return 6
  if (result.rewardType === "discount") return 7
  return 5
}

type SpinWheelProps = {
  spinsLeftToday: number
  maxSpinsPerDay: number
  enabled: boolean
  onSpinRequest: () => Promise<SpinRewardResult>
  onResultApplied: (result: SpinRewardResult) => void
}

export function SpinWheel({
  spinsLeftToday,
  maxSpinsPerDay,
  enabled,
  onSpinRequest,
  onResultApplied,
}: SpinWheelProps) {
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<SpinRewardResult | null>(null)
  const [showResult, setShowResult] = useState(false)

  const segmentAngle = 360 / SEGMENTS.length
  const wheelGradient = useMemo(() => {
    return `conic-gradient(${SEGMENTS.map((segment, index) => {
      const from = index * segmentAngle
      const to = from + segmentAngle
      return `${segment.tone} ${from}deg ${to}deg`
    }).join(", ")})`
  }, [segmentAngle])

  const spinDisabled = spinning || !enabled || spinsLeftToday <= 0

  async function handleSpin() {
    if (!enabled) return
    if (spinsLeftToday <= 0) {
      setResult({
        rewardType: "none",
        label: "You have already used today's spin. Come back tomorrow.",
        amount: 0,
        balance: 0,
      })
      setShowResult(true)
      return
    }

    setSpinning(true)
    try {
      const spinResult = await onSpinRequest()
      const winningIndex = resolveWinningIndex(spinResult)
      const centerOfSegment = winningIndex * segmentAngle + segmentAngle / 2
      const finalAngle = (360 - centerOfSegment) % 360
      const extraTurns = 360 * (6 + Math.floor(Math.random() * 2))
      const nextRotation = rotation + extraTurns + ((finalAngle - (rotation % 360) + 360) % 360)

      setResult(spinResult)
      setRotation(nextRotation)

      window.setTimeout(() => {
        setSpinning(false)
        setShowResult(true)
        onResultApplied(spinResult)
      }, 4600)
    } catch (error) {
      setSpinning(false)
      const message = error instanceof Error ? error.message : "Spin failed"
      setResult({ rewardType: "none", label: message, amount: 0, balance: 0 })
      setShowResult(true)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spin Wheel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Spins left today: {spinsLeftToday}/{maxSpinsPerDay}
        </p>

        <div className="mx-auto w-full max-w-[320px]">
          <div className="relative aspect-square">
            <div className="absolute left-1/2 z-20 -translate-x-1/2 -translate-y-2">
              <div className="h-0 w-0 border-x-[12px] border-t-[18px] border-x-transparent border-t-primary" />
            </div>
            <div
              className="relative h-full w-full rounded-full border-4 border-card shadow-lg"
              style={{
                background: wheelGradient,
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? "transform 4.6s cubic-bezier(0.2, 0.9, 0.15, 1)" : "none",
              }}
            >
              {SEGMENTS.map((segment, index) => (
                <div
                  key={segment.label}
                  className="absolute left-1/2 top-1/2 origin-center text-center text-[10px] font-semibold text-white drop-shadow sm:text-xs"
                  style={{
                    transform: `rotate(${index * segmentAngle + segmentAngle / 2}deg) translateY(-122px)`,
                  }}
                >
                  <span className="block -rotate-90 max-w-20 leading-tight">{segment.label}</span>
                </div>
              ))}
              <div className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-background shadow-md">
                <Gift className="size-6 text-primary" />
              </div>
            </div>
          </div>
        </div>

        <Button onClick={handleSpin} disabled={spinDisabled} className="w-full">
          {spinning ? "Spinning..." : "Spin Now"}
        </Button>
        {!enabled ? (
          <p className="text-xs text-muted-foreground">Spin wheel is currently disabled by admin.</p>
        ) : null}
      </CardContent>

      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Spin Result</DialogTitle>
            <DialogDescription>
              {result?.rewardType === "none" ? "Better luck next time." : "Congratulations!"}
            </DialogDescription>
          </DialogHeader>
          <div className="relative overflow-hidden rounded-lg border bg-muted/30 p-4 text-center">
            <div className="pointer-events-none absolute inset-0">
              {result?.rewardType !== "none"
                ? Array.from({ length: 12 }).map((_, index) => (
                    <span
                      key={`confetti-${index}`}
                      className="absolute top-0 h-2 w-2 animate-[confettiDrop_900ms_ease-in_forwards] rounded-full"
                      style={{
                        left: `${8 + index * 7}%`,
                        background: index % 2 === 0 ? "#f59e0b" : "#22c55e",
                        animationDelay: `${index * 40}ms`,
                      }}
                    />
                  ))
                : null}
            </div>
            <p className="text-lg font-semibold">{result?.label || "Spin completed"}</p>
            {result?.rewardType === "money" ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Wallet updated. New balance: ₹{result.balance.toLocaleString("en-IN")}
              </p>
            ) : null}
            {result?.rewardType === "discount" ? (
              <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
                <TicketPercent className="size-4" /> Discount added to your reward flow
              </p>
            ) : null}
          </div>
          <Button onClick={() => setShowResult(false)}>Close</Button>
        </DialogContent>
      </Dialog>

      <style jsx>{`
        @keyframes confettiDrop {
          0% {
            transform: translateY(-8px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(110px) rotate(240deg);
            opacity: 0;
          }
        }
      `}</style>
    </Card>
  )
}
