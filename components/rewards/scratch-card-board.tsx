"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type ScratchCardItem = {
  id: string
  status: "locked" | "available" | "scratched"
  rewardAmount: number | null
  createdAt: number
}

type ScratchCollectResult = {
  amount: number
  balance: number
}

type ScratchCardBoardProps = {
  cards: ScratchCardItem[]
  onCollect: (cardId: string) => Promise<ScratchCollectResult>
  onCollected: (cardId: string, reward: ScratchCollectResult) => void
}

const SCRATCH_THRESHOLD = 0.58

export function ScratchCardBoard({ cards, onCollect, onCollected }: ScratchCardBoardProps) {
  const [activeCard, setActiveCard] = useState<ScratchCardItem | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [collectResult, setCollectResult] = useState<ScratchCollectResult | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const revealChecked = useRef(false)

  const availableCards = useMemo(
    () => cards.filter((card) => card.status === "available"),
    [cards]
  )

  useEffect(() => {
    if (!activeCard || !canvasRef.current) return
    const canvas = canvasRef.current
    const parent = canvas.parentElement
    if (!parent) return

    const ratio = window.devicePixelRatio || 1
    const width = parent.clientWidth
    const height = 220
    canvas.width = Math.floor(width * ratio)
    canvas.height = Math.floor(height * ratio)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = "#94a3b8"
    ctx.fillRect(0, 0, width, height)

    ctx.fillStyle = "#e2e8f0"
    for (let x = 0; x < width; x += 18) {
      for (let y = 0; y < height; y += 18) {
        if ((x + y) % 36 === 0) ctx.fillRect(x, y, 4, 4)
      }
    }

    ctx.fillStyle = "#0f172a"
    ctx.font = "600 18px sans-serif"
    ctx.textAlign = "center"
    ctx.fillText("Scratch to reveal reward", width / 2, height / 2)
    ctx.globalCompositeOperation = "destination-out"
    revealChecked.current = false
    setRevealed(false)
    setCollectResult(null)
  }, [activeCard])

  function pointerPosition(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  function eraseAt(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const point = pointerPosition(event)
    if (!point) return
    ctx.beginPath()
    ctx.arc(point.x, point.y, 18, 0, Math.PI * 2)
    ctx.fill()
    if (!revealChecked.current) {
      checkRevealProgress()
    }
  }

  function checkRevealProgress() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const { width, height } = canvas
    const imageData = ctx.getImageData(0, 0, width, height)
    const pixels = imageData.data
    let transparent = 0
    const totalPixels = width * height
    for (let idx = 3; idx < pixels.length; idx += 4) {
      if (pixels[idx] < 30) transparent += 1
    }
    if (transparent / totalPixels >= SCRATCH_THRESHOLD) {
      revealChecked.current = true
      setRevealed(true)
      ctx.clearRect(0, 0, width, height)
    }
  }

  async function collectReward() {
    if (!activeCard || collecting) return
    setCollecting(true)
    try {
      const reward = await onCollect(activeCard.id)
      setCollectResult(reward)
      onCollected(activeCard.id, reward)
    } finally {
      setCollecting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {availableCards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No available scratch cards right now.</p>
        ) : (
          availableCards.map((card) => (
            <Card key={card.id}>
              <CardHeader>
                <CardTitle className="text-base">Card #{card.id.slice(-6)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border border-dashed bg-muted/40 p-4 text-center text-sm font-medium">
                  Scratch to reveal reward
                </div>
                <Button className="w-full" onClick={() => setActiveCard(card)}>
                  Open Card
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={Boolean(activeCard)} onOpenChange={(open) => !open && setActiveCard(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Scratch Card</DialogTitle>
            <DialogDescription>Use mouse or touch to scratch at least 58% area.</DialogDescription>
          </DialogHeader>

          <div className="relative overflow-hidden rounded-lg border bg-gradient-to-br from-amber-50 to-orange-100 p-4 dark:from-slate-900 dark:to-slate-800">
            <div className="mb-3 rounded-lg bg-white/80 p-4 text-center dark:bg-black/20">
              <p className="text-sm text-muted-foreground">Hidden Reward</p>
              <p className="text-2xl font-bold">
                {collectResult
                  ? `₹${collectResult.amount.toLocaleString("en-IN")}`
                  : revealed
                    ? "Reward ready to collect"
                    : "????"}
              </p>
            </div>
            <canvas
              ref={canvasRef}
              className="touch-none rounded-lg border"
              onPointerDown={(event) => {
                drawing.current = true
                eraseAt(event)
              }}
              onPointerMove={(event) => {
                if (!drawing.current) return
                eraseAt(event)
              }}
              onPointerUp={() => {
                drawing.current = false
              }}
              onPointerLeave={() => {
                drawing.current = false
              }}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {revealed ? "Reward unlocked!" : "Scratch more area to unlock reward."}
            </p>
            <Button onClick={collectReward} disabled={!revealed || collecting || Boolean(collectResult)}>
              {collecting ? "Collecting..." : collectResult ? "Collected" : "Collect Reward"}
            </Button>
          </div>

          {collectResult ? (
            <div className="relative overflow-hidden rounded-lg border bg-emerald-50 p-4 text-center dark:bg-emerald-950/30">
              <div className="pointer-events-none absolute inset-0">
                {Array.from({ length: 14 }).map((_, index) => (
                  <span
                    key={`coin-${index}`}
                    className="absolute -top-2 size-2 animate-[coinDrop_900ms_ease-in_forwards] rounded-full bg-amber-400"
                    style={{ left: `${5 + index * 6}%`, animationDelay: `${index * 30}ms` }}
                  />
                ))}
              </div>
              <p className="inline-flex items-center gap-1 text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                <Sparkles className="size-5" /> You won ₹{collectResult.amount}
              </p>
              <p className="text-sm text-muted-foreground">
                Wallet updated instantly. Current balance: ₹{collectResult.balance.toLocaleString("en-IN")}
              </p>
            </div>
          ) : null}

          <style jsx>{`
            @keyframes coinDrop {
              0% {
                transform: translateY(0) scale(1);
                opacity: 1;
              }
              100% {
                transform: translateY(70px) scale(0.7);
                opacity: 0;
              }
            }
          `}</style>
        </DialogContent>
      </Dialog>
    </div>
  )
}
