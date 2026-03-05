import { NextResponse } from "next/server"
import { adminDb } from "@/lib/server/firebase-admin"
import { requirePermission, toHttpError } from "@/lib/server/permission-check"
import { calculateRefundAmount } from "@/lib/server/refund-policy"

function normalizeRefundStatus(s: string): string {
  if (s === "requested") return "refund_requested"
  if (s === "processed") return "refunded"
  return s
}

export async function GET(request: Request) {
  try {
    await requirePermission(request, "REFUNDS_MANAGE")
  } catch (error) {
    const mapped = toHttpError(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
  try {
    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get("status") || "all" // all | refund_requested | approved | rejected | refunded
    const snap = await adminDb
      .collection("bookings")
      .where("status", "==", "cancelled")
      .limit(500)
      .get()
    let items = snap.docs
      .map((doc) => {
        const d = doc.data()
        const refundStatus = normalizeRefundStatus(String(d.refundStatus || "none"))
        return {
          id: doc.id,
          ...d,
          refundStatus,
          requestedDate: d.cancelledAt,
        }
      })
      .filter((b) => Number(b.advancePaid || 0) > 0 || ["refund_requested", "approved", "rejected", "refunded"].includes(b.refundStatus))
    if (statusFilter !== "all") {
      items = items.filter((b) => b.refundStatus === statusFilter)
    }
    const userIds = [...new Set(items.map((b) => b.userId).filter(Boolean))] as string[]
    const userMap: Record<string, { displayName?: string; name?: string; email?: string }> = {}
    if (userIds.length > 0) {
      const userSnaps = await Promise.all(userIds.map((id) => adminDb.collection("users").doc(id).get()))
      userSnaps.forEach((s, i) => {
        const id = userIds[i]
        if (s.exists && id) userMap[id] = (s.data() || {}) as { displayName?: string; name?: string; email?: string }
      })
    }
    const settingsSnap = await adminDb.collection("settings").doc("global").get()
    const settings = (settingsSnap.data() || {}) as { refundPolicyRules?: Array<{ daysBefore: number; percent: number }> }
    const rules = Array.isArray(settings.refundPolicyRules) && settings.refundPolicyRules.length > 0 ? settings.refundPolicyRules : undefined

    items = items.map((b) => {
      const u = b.userId ? userMap[b.userId as string] : null
      let refundAmount = Number(b.refundAmount ?? 0)
      const advancePaid = Number(b.advancePaid ?? 0)
      if (refundAmount <= 0 && advancePaid > 0) {
        const { amount } = calculateRefundAmount(advancePaid, b.checkInDate, rules)
        refundAmount = amount
      }
      return {
        ...b,
        refundAmount,
        customerName: u?.displayName || u?.name || (b as Record<string, unknown>).customerName,
        customer_email: u?.email,
      }
    })
    items.sort((a, b) => {
      const tA = (a.requestedDate as { toMillis?: () => number })?.toMillis?.() ?? 0
      const tB = (b.requestedDate as { toMillis?: () => number })?.toMillis?.() ?? 0
      return tB - tA
    })
    return NextResponse.json({ items })
  } catch (error) {
    console.error("GET /api/admin/refunds", error)
    return NextResponse.json({ error: "Failed to load refunds" }, { status: 500 })
  }
}
