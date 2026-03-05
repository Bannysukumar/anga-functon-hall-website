"use client"

import { useEffect, useState } from "react"
import { PermissionGuard } from "@/components/auth/permission-guard"
import { useAuth } from "@/lib/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

type Payment = {
  id: string
  bookingId?: string | null
  customerId?: string | null
  amount: number
  method: string
  gateway?: string
  note?: string
  createdAt?: { _seconds?: number }
}

export default function ReceptionistPaymentsPage() {
  const { user, hasPermission, isAdminUser } = useAuth()
  const [payments, setPayments] = useState<Payment[]>([])
  const [creatingReceipt, setCreatingReceipt] = useState(false)
  const [page, setPage] = useState(1)
  const [bookingSearchInput, setBookingSearchInput] = useState("")
  const [appliedBookingSearch, setAppliedBookingSearch] = useState("")
  const pageSize = 10
  const [form, setForm] = useState({
    bookingId: "",
    customerId: "",
    amount: "",
    method: "cash",
    note: "",
  })

  function paymentMethodLabel(payment: Payment) {
    const method = String(payment.method || "").trim()
    if (method) return method
    const gateway = String(payment.gateway || "").trim().toLowerCase()
    if (gateway === "razorpay") return "online (razorpay)"
    if (gateway === "manual_receipt" || gateway === "manual_reception") return "cash"
    return "unknown"
  }

  async function loadPayments() {
    if (!user) return
    try {
      const response = await fetch("/api/receptionist/payments?limit=100", {
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to load payments")
      setPayments(json.items || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load payments")
    }
  }

  useEffect(() => {
    loadPayments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const normalizedSearch = appliedBookingSearch.trim().toLowerCase()
  const filteredPayments = normalizedSearch
    ? payments.filter((payment) => (payment.bookingId || "").toLowerCase().includes(normalizedSearch))
    : payments

  useEffect(() => {
    setPage(1)
  }, [filteredPayments.length])

  async function createReceipt() {
    if (!user || creatingReceipt) return
    const amount = Number(form.amount)
    const method = form.method.trim()
    const bookingId = form.bookingId.trim()
    const customerId = form.customerId.trim()
    const note = form.note.trim()

    if (!Number.isFinite(amount) || amount < 1) {
      toast.error("Amount must be at least 1.")
      return
    }
    if (method.length < 2 || method.length > 40) {
      toast.error("Payment method must be between 2 and 40 characters.")
      return
    }
    if (bookingId.length > 120 || customerId.length > 120) {
      toast.error("Booking ID / Customer ID is too long.")
      return
    }
    if (note.length > 500) {
      toast.error("Note must be 500 characters or less.")
      return
    }

    setCreatingReceipt(true)
    try {
      const response = await fetch("/api/receptionist/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({
          bookingId: bookingId || undefined,
          customerId: customerId || undefined,
          amount,
          method,
          note,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to create receipt")
      toast.success("Payment receipt created")
      if (bookingId && json.bookingLinked === false) {
        toast.message("Receipt saved as standalone because booking ID was not found.")
      }
      setForm({ bookingId: "", customerId: "", amount: "", method: "cash", note: "" })
      loadPayments()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create receipt")
    } finally {
      setCreatingReceipt(false)
    }
  }

  async function downloadReceipt(paymentId: string) {
    if (!user) return
    try {
      const response = await fetch(`/api/receptionist/payments/${paymentId}/receipt`, {
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      })
      if (!response.ok) {
        const json = await response.json()
        throw new Error(json.error || "Failed to download receipt")
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `payment-receipt-${paymentId}.pdf`
      link.click()
      URL.revokeObjectURL(url)
      toast.success("Receipt downloaded")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download receipt")
    }
  }

  function printPayment(payment: Payment) {
    const popup = window.open("", "_blank")
    if (!popup) return
    popup.document.write(`
      <html>
        <head><title>Payment Receipt ${payment.id}</title></head>
        <body style="font-family: Arial; padding: 24px;">
          <h2>Payment Receipt</h2>
          <p><strong>ID:</strong> ${payment.id}</p>
          <p><strong>Booking:</strong> ${payment.bookingId || "-"}</p>
          <p><strong>Customer:</strong> ${payment.customerId || "-"}</p>
          <p><strong>Amount:</strong> INR ${Number(payment.amount || 0).toLocaleString("en-IN")}</p>
          <p><strong>Method:</strong> ${paymentMethodLabel(payment)}</p>
          <p><strong>Note:</strong> ${payment.note || "-"}</p>
        </body>
      </html>
    `)
    popup.document.close()
    popup.focus()
    popup.print()
  }

  function runBookingSearch() {
    setAppliedBookingSearch(bookingSearchInput)
  }

  function clearBookingSearch() {
    setBookingSearchInput("")
    setAppliedBookingSearch("")
  }

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize))
  const pagedPayments = filteredPayments.slice((page - 1) * pageSize, page * pageSize)

  return (
    <PermissionGuard requiredPermissions={["view_payments"]} allowedRoles={["admin", "receptionist"]}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payments & Receipts</h1>
          <p className="text-sm text-muted-foreground">Create receipts and review payment history.</p>
        </div>

        {(isAdminUser || hasPermission("create_payment_receipt")) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create Payment Receipt</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Booking ID (optional)</Label>
                <Input
                  value={form.bookingId}
                  onChange={(e) => setForm({ ...form, bookingId: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to create a standalone receipt.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Customer ID (optional)</Label>
                <Input
                  value={form.customerId}
                  onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Method</Label>
                <Input
                  value={form.method}
                  onChange={(e) => setForm({ ...form, method: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <Label>Note</Label>
                <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Button onClick={createReceipt} disabled={creatingReceipt}>
                  {creatingReceipt ? "Creating..." : "Create Receipt"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="booking-search">Search by Booking ID</Label>
                <Input
                  id="booking-search"
                  placeholder="Enter booking ID"
                  value={bookingSearchInput}
                  onChange={(e) => setBookingSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") runBookingSearch()
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={runBookingSearch}>
                  Search
                </Button>
                {appliedBookingSearch && (
                  <Button type="button" variant="outline" onClick={clearBookingSearch}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {filteredPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments found.</p>
              ) : (
                pagedPayments.map((payment) => (
                  <div key={payment.id} className="rounded-lg border p-3">
                    <p className="font-medium">₹{Number(payment.amount || 0).toLocaleString("en-IN")}</p>
                    <p className="text-xs text-muted-foreground">
                      Method: {paymentMethodLabel(payment)} | Booking: {payment.bookingId || "-"} |
                      Customer: {payment.customerId || "-"}
                    </p>
                    {payment.note && <p className="mt-1 text-xs text-muted-foreground">{payment.note}</p>}
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => printPayment(payment)}>
                        Print
                      </Button>
                      <Button size="sm" onClick={() => downloadReceipt(payment.id)}>
                        Download PDF
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {filteredPayments.length > pageSize && (
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    Prev
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  )
}
