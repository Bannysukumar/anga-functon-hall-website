"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

function PaymentVerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = String(searchParams.get("order_id") || searchParams.get("orderId") || "").trim()
  const [state, setState] = useState<"polling" | "timeout" | "failed">("polling")

  useEffect(() => {
    if (!orderId) {
      setState("failed")
      return
    }
    let cancelled = false
    let attempts = 0
    const maxAttempts = 6
    const poll = async () => {
      if (cancelled) return
      try {
        const response = await fetch(`/api/payment/status/${encodeURIComponent(orderId)}`)
        const data = (await response.json()) as { paymentStatus?: string; bookingId?: string }
        if (data.paymentStatus === "paid") {
          router.push(data.bookingId ? `/checkout/success?bookingId=${data.bookingId}` : "/checkout/success")
          return
        }
        if (data.paymentStatus === "failed") {
          setState("failed")
          return
        }
      } catch {
        // continue polling
      }
      attempts += 1
      if (attempts >= maxAttempts) {
        setState("timeout")
        return
      }
      setTimeout(poll, 5000)
    }
    void poll()
    return () => {
      cancelled = true
    }
  }, [orderId, router])

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardContent className="py-8 text-center">
            {state === "polling" ? (
              <>
                <Spinner className="mx-auto h-8 w-8 text-primary" />
                <p className="mt-4 text-sm text-muted-foreground">Checking payment status...</p>
              </>
            ) : state === "timeout" ? (
              <>
                <p className="text-base font-medium text-foreground">
                  We could not confirm your payment yet.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Please refresh or check your bookings page.
                </p>
                <div className="mt-4 flex gap-2">
                  <Button className="w-full" onClick={() => window.location.reload()}>
                    Refresh
                  </Button>
                  <Button className="w-full" variant="outline" onClick={() => router.push("/dashboard")}>
                    My Bookings
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-base font-medium text-destructive">Payment verification failed.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  We could not find this payment. Please try again or contact support.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  )
}

export default function PaymentVerifyPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading...</div>}>
      <PaymentVerifyContent />
    </Suspense>
  )
}
