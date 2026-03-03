"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { getInvoiceDownloadUrl } from "@/lib/booking-functions"
import { useAuth } from "@/lib/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Receipt, ArrowLeft } from "lucide-react"

export default function InvoiceDownloadPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading } = useAuth()
  const [downloading, setDownloading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login")
    }
  }, [loading, router, user])

  useEffect(() => {
    async function run() {
      const invoiceId = String(params.id || "")
      if (!invoiceId) {
        setError("Invoice id is missing.")
        setDownloading(false)
        return
      }
      if (!user) return
      setDownloading(true)
      setError("")
      try {
        const result = await getInvoiceDownloadUrl(invoiceId)
        if (result.url) {
          window.location.href = result.url
          return
        }
        setError("Invoice link is unavailable.")
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unable to fetch invoice download link."
        setError(message)
      } finally {
        setDownloading(false)
      }
    }
    run()
  }, [params.id, user])

  if (!user) return null

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Invoice Download
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {downloading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing secure invoice download...
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              If the download did not start, try again from your booking details.
            </p>
          )}
          <Button asChild variant="outline">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
