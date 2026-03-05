import { NextResponse } from "next/server"
import { Timestamp } from "firebase-admin/firestore"
import PDFDocument from "pdfkit"
import { adminDb } from "@/lib/server/firebase-admin"
import { requirePermission, toHttpError } from "@/lib/server/permission-check"
import { getRequestMeta } from "@/lib/server/request-meta"

function paymentMethodLabel(payment: Record<string, unknown>) {
  const method = String(payment.method || "").trim()
  if (method) return method
  const gateway = String(payment.gateway || "").trim().toLowerCase()
  if (gateway === "razorpay") return "online (razorpay)"
  if (gateway === "manual_receipt" || gateway === "manual_reception") return "cash"
  return "unknown"
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { uid } = await requirePermission(request, "view_payments")
    const meta = getRequestMeta(request)
    const { id } = await params

    const paymentSnap = await adminDb.collection("payments").doc(id).get()
    if (!paymentSnap.exists) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 })
    }
    const payment = paymentSnap.data() || {}

    const doc = new PDFDocument({ size: "A4", margin: 40 })
    const chunks: Uint8Array[] = []
    doc.on("data", (chunk: Buffer) => chunks.push(chunk))
    const done = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks.map((item) => Buffer.from(item)))))
    })

    doc.fontSize(18).text("Payment Receipt")
    doc.moveDown(0.5)
    doc.fontSize(10).text(`Receipt ID: ${id}`)
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`)
    doc.moveDown()
    doc.fontSize(11).text(`Invoice: ${String(payment.invoiceNumber || "-")}`)
    doc.text(`Booking ID: ${String(payment.bookingId || "-")}`)
    doc.text(`Customer ID: ${String(payment.customerId || "-")}`)
    doc.text(`Amount: INR ${Number(payment.amount || 0).toLocaleString("en-IN")}`)
    doc.text(`Method: ${paymentMethodLabel(payment)}`)
    doc.text(`Gateway: ${String(payment.gateway || "-")}`)
    doc.text(`Status: ${String(payment.status || "-")}`)
    doc.text(`Note: ${String(payment.note || "-")}`)
    doc.end()
    const pdfBuffer = await done

    await adminDb.collection("auditLogs").add({
      entity: "payment",
      entityId: id,
      action: "DOWNLOAD_RECEIPT",
      message: "Downloaded payment receipt PDF",
      payload: { ip: meta.ip, userAgent: meta.userAgent },
      createdBy: uid,
      createdAt: Timestamp.now(),
    })

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="payment-receipt-${id}.pdf"`,
      },
    })
  } catch (error) {
    const mapped = toHttpError(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}
