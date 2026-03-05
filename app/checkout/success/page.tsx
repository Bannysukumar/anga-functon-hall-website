"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { CheckCircle2, FileText, Home } from "lucide-react"
import { getBooking } from "@/lib/firebase-db"

interface ConfirmationData {
  bookingId: string
  invoiceId?: string
  invoiceNumber: string
  invoicePdfUrl?: string
  allocatedLabels?: string[]
  emailStatus?: "pending" | "sent" | "failed"
  listingTitle: string
  totalAmount: number
  advancePaid: number
}

export default function CheckoutSuccessPage() {
  const [data, setData] = useState<ConfirmationData | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()
  const bookingIdFromQuery = searchParams.get("bookingId")?.trim()

  useEffect(() => {
    async function load() {
      const stored = sessionStorage.getItem("bookingConfirmation")
      if (stored) {
        setData(JSON.parse(stored))
        setLoading(false)
        return
      }
      if (bookingIdFromQuery) {
        try {
          const booking = await getBooking(bookingIdFromQuery)
          if (booking) {
            setData({
              bookingId: booking.id,
              invoiceId: booking.invoiceId,
              invoiceNumber: booking.invoiceNumber || "",
              listingTitle: booking.listingTitle || "Booking",
              totalAmount: booking.totalAmount || 0,
              advancePaid: booking.advancePaid || 0,
            })
          } else {
            router.push("/")
          }
        } catch {
          router.push("/")
        } finally {
          setLoading(false)
        }
        return
      }
      router.push("/")
      setLoading(false)
    }
    load()
  }, [router, bookingIdFromQuery])

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      </div>
    )
  }
  if (!data) return null

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center bg-secondary/30 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="flex flex-col items-center gap-6 p-8 text-center">
            <div className="rounded-full bg-emerald-100 p-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>

            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold text-foreground">
                Booking Confirmed!
              </h1>
              <p className="text-sm text-muted-foreground">
                Your booking has been successfully placed and confirmed.
              </p>
            </div>

            <div className="w-full rounded-lg bg-secondary p-4 text-left">
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Venue</span>
                  <span className="font-medium text-foreground">
                    {data.listingTitle}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice</span>
                  <span className="font-mono text-xs text-foreground">
                    {data.invoiceNumber}
                  </span>
                </div>
                {data.allocatedLabels && data.allocatedLabels.length > 0 && (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Allocated</span>
                    <span className="font-medium text-foreground text-right">
                      {data.allocatedLabels.join(", ")}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium text-foreground capitalize">
                    {data.emailStatus || "pending"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium text-foreground">
                    {`\u20B9${data.totalAmount.toLocaleString("en-IN")}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-medium text-emerald-600">
                    {`\u20B9${data.advancePaid.toLocaleString("en-IN")}`}
                  </span>
                </div>
                {data.totalAmount - data.advancePaid > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Due</span>
                    <span className="font-medium text-foreground">
                      {`\u20B9${(data.totalAmount - data.advancePaid).toLocaleString("en-IN")}`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex w-full flex-col gap-3">
              <Link href={`/dashboard/bookings/${data.bookingId}`}>
                <Button className="w-full" variant="default">
                  <FileText className="mr-2 h-4 w-4" />
                  View Booking Details
                </Button>
              </Link>
              {data.invoiceId && (
                <Link href={`/invoice/${data.invoiceId}`}>
                  <Button className="w-full" variant="secondary">
                    <FileText className="mr-2 h-4 w-4" />
                    Download Invoice PDF
                  </Button>
                </Link>
              )}
              <Link href="/">
                <Button className="w-full" variant="outline">
                  <Home className="mr-2 h-4 w-4" />
                  Back to Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  )
}
