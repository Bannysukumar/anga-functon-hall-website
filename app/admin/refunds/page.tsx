"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/hooks/use-auth"
import {
  REFUND_STATUS_LABELS,
  REFUND_STATUS_COLORS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Banknote,
  Loader2,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  ExternalLink,
  RefreshCw,
  Receipt,
  Info,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

type RefundItem = {
  id: string
  listingTitle?: string
  checkInDate?: unknown
  advancePaid?: number
  refundAmount?: number
  paymentMethod?: string
  refundStatus: string
  requestedDate?: unknown
  userId?: string
  invoiceNumber?: string
  gatewayRefundId?: string | null
}

function formatDate(value: unknown): string {
  if (!value) return "—"
  const d =
    typeof (value as { toDate?: () => Date }).toDate === "function"
      ? (value as { toDate: () => Date }).toDate()
      : (value as { seconds?: number }).seconds != null
        ? new Date((value as { seconds: number }).seconds * 1000)
        : typeof value === "string"
          ? new Date(value)
          : null
  if (!d || Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function getCustomerName(item: RefundItem): string {
  return (item as Record<string, unknown>).customerName as string
    || (item as Record<string, unknown>).customer_name as string
    || "—"
}

export default function AdminRefundsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<RefundItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    bookingId: string
    action: "approve" | "reject" | "process" | "complete-cash"
  } | null>(null)
  const [cashRefundMethod, setCashRefundMethod] = useState<"cash" | "upi" | "bank_transfer">("cash")
  const [cashRefundBookingId, setCashRefundBookingId] = useState<string | null>(null)

  const loadRefunds = async () => {
    if (!user) return
    setLoading(true)
    try {
      const token = await user.getIdToken()
      const url =
        statusFilter === "all"
          ? "/api/admin/refunds"
          : `/api/admin/refunds?status=${encodeURIComponent(statusFilter)}`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to load refunds")
      }
      const data = await res.json()
      setItems(data.items || [])
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load refunds",
        variant: "destructive",
      })
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRefunds()
  }, [user, statusFilter])

  const runAction = async (
    bookingId: string,
    action: "approve" | "reject" | "process" | "complete-cash",
    body?: { refund_method?: string }
  ) => {
    if (!user) return
    setActionLoading(bookingId)
    try {
      const token = await user.getIdToken()
      const url = `/api/admin/refunds/${bookingId}/${action === "complete-cash" ? "complete-cash" : action}`
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Action failed")
      toast({ title: action === "approve" ? "Refund approved" : action === "reject" ? "Refund rejected" : "Refund completed" })
      setConfirmAction(null)
      setCashRefundBookingId(null)
      loadRefunds()
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Action failed",
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const paymentMethod = (item: RefundItem) =>
    item.paymentMethod
    || (String((item as Record<string, unknown>).razorpayPaymentId || "").trim() ? "online" : "cash")

  const hasRazorpayPaymentId = (item: RefundItem) =>
    String((item as Record<string, unknown>).razorpayPaymentId || "").trim() !== ""

  const canProcess = (item: RefundItem) => {
    const status = item.refundStatus
    return status === "refund_requested" || status === "requested" || status === "approved"
  }

  const canApproveOrReject = (item: RefundItem) => {
    const status = item.refundStatus
    if (status === "approved" || status === "rejected" || status === "refunded" || status === "processed") return false
    return true
  }

  const isOnline = (item: RefundItem) =>
    paymentMethod(item) === "online" && hasRazorpayPaymentId(item) && Number(item.refundAmount ?? 0) > 0
  const isCash = (item: RefundItem) => !hasRazorpayPaymentId(item) || paymentMethod(item) === "cash"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Refunds</h1>
          <p className="text-sm text-muted-foreground">
            Review and process refund requests for cancelled bookings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="refund_requested">Refund Requested</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadRefunds} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
        <Info className="h-5 w-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">About online refunds</p>
          <p className="mt-1 text-muted-foreground dark:text-blue-300/90">
            When you &quot;Process refund (gateway)&quot; for an <strong>Online</strong> payment, the amount is sent back via the payment gateway (Razorpay) to the customer&apos;s original card/UPI/bank. It typically appears in their account within <strong>5–7 business days</strong>. The amount does not return to your merchant account—it goes directly to the customer. You can track the refund in your Razorpay dashboard using the Refund ID shown below for completed online refunds.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Refund requests
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {items.length} cancelled booking(s) with refund data
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No refund requests match the filter.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Event Date</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Refund Amount</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Refund Status</TableHead>
                    <TableHead>Refund ID</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">
                        <Link
                          href={`/admin/bookings?highlight=${item.id}`}
                          className="text-primary hover:underline"
                        >
                          {item.invoiceNumber || item.id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell>{getCustomerName(item) || "—"}</TableCell>
                      <TableCell>{formatDate(item.checkInDate)}</TableCell>
                      <TableCell>₹{Number(item.advancePaid || 0).toLocaleString("en-IN")}</TableCell>
                      <TableCell>₹{Number(item.refundAmount || 0).toLocaleString("en-IN")}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {PAYMENT_METHOD_LABELS[paymentMethod(item)] || paymentMethod(item)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={REFUND_STATUS_COLORS[item.refundStatus] || ""}>
                          {REFUND_STATUS_LABELS[item.refundStatus] || item.refundStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground max-w-[140px] truncate" title={item.gatewayRefundId || undefined}>
                        {item.refundStatus === "refunded" && paymentMethod(item) === "online" && item.gatewayRefundId
                          ? item.gatewayRefundId
                          : "—"}
                      </TableCell>
                      <TableCell>{formatDate(item.requestedDate)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/bookings?highlight=${item.id}`}>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                View booking
                              </Link>
                            </DropdownMenuItem>
                            {canApproveOrReject(item) && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => setConfirmAction({ bookingId: item.id, action: "approve" })}
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Approve refund
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setConfirmAction({ bookingId: item.id, action: "reject" })}
                                  className="text-destructive"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Reject refund
                                </DropdownMenuItem>
                              </>
                            )}
                            {canProcess(item) && (
                              <>
                                {isOnline(item) && (
                                  <DropdownMenuItem
                                    onClick={() => setConfirmAction({ bookingId: item.id, action: "process" })}
                                  >
                                    <Banknote className="mr-2 h-4 w-4" />
                                    Process refund (gateway)
                                  </DropdownMenuItem>
                                )}
                                {isCash(item) && (
                                  <DropdownMenuItem
                                    onClick={() => setCashRefundBookingId(item.id)}
                                  >
                                    <Receipt className="mr-2 h-4 w-4" />
                                    Mark refund completed
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.action === "approve" && "Approve refund"}
              {confirmAction?.action === "reject" && "Reject refund"}
              {confirmAction?.action === "process" && "Process refund via gateway"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === "approve" && "The customer will be notified that their refund has been approved."}
              {confirmAction?.action === "reject" && "The refund request will be rejected and the customer will be notified."}
              {confirmAction?.action === "process" && "The refund will be executed through the payment gateway. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                confirmAction && runAction(confirmAction.bookingId, confirmAction.action)
              }
              disabled={actionLoading === confirmAction?.bookingId}
            >
              {actionLoading === confirmAction?.bookingId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Confirm"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!cashRefundBookingId} onOpenChange={(open) => !open && setCashRefundBookingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark refund completed</DialogTitle>
            <DialogDescription>
              Select how the refund was given to the customer. This will mark the refund as completed and notify the customer.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Refund method</label>
              <Select
                value={cashRefundMethod}
                onValueChange={(v) => setCashRefundMethod(v as "cash" | "upi" | "bank_transfer")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCashRefundBookingId(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                cashRefundBookingId &&
                runAction(cashRefundBookingId, "complete-cash", {
                  refund_method: cashRefundMethod,
                })
              }
              disabled={!!cashRefundBookingId && actionLoading === cashRefundBookingId}
            >
              {cashRefundBookingId && actionLoading === cashRefundBookingId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Mark completed"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
