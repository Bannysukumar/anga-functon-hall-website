import { NextResponse } from "next/server"
import { adminDb } from "@/lib/server/firebase-admin"
import { requirePermission, toHttpError } from "@/lib/server/permission-check"
import PDFDocument from "pdfkit"
import { getRequestMeta } from "@/lib/server/request-meta"
import { Timestamp } from "firebase-admin/firestore"

function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return ""
  const headers = Object.keys(rows[0])
  const lines = [headers.join(",")]
  rows.forEach((row) => {
    lines.push(
      headers
        .map((header) => {
          const raw = row[header]
          const cell = raw === null || raw === undefined ? "" : String(raw)
          return `"${cell.replace(/"/g, '""')}"`
        })
        .join(",")
    )
  })
  return lines.join("\n")
}

export async function GET(request: Request) {
  try {
    const { uid } = await requirePermission(request, "view_reports")
    const meta = getRequestMeta(request)
    const url = new URL(request.url)
    const format = (url.searchParams.get("format") || "json").toLowerCase()
    const dateFrom = url.searchParams.get("from")
    const dateTo = url.searchParams.get("to")

    const bookingsSnap = await adminDb.collection("bookings").orderBy("createdAt", "desc").limit(500).get()
    const paymentsSnap = await adminDb.collection("payments").orderBy("createdAt", "desc").limit(500).get()

    const bookings = bookingsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    const payments = paymentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

    const inDateRange = (value: unknown) => {
      const date = value && typeof value === "object" && "toDate" in (value as Record<string, unknown>)
        ? ((value as { toDate: () => Date }).toDate())
        : null
      if (!date) return true
      if (dateFrom && date < new Date(`${dateFrom}T00:00:00`)) return false
      if (dateTo && date > new Date(`${dateTo}T23:59:59`)) return false
      return true
    }

    const filteredBookings = bookings.filter((booking) => inDateRange(booking.createdAt))
    const filteredPayments = payments.filter((payment) => inDateRange(payment.createdAt))

    const summary = {
      bookingCount: filteredBookings.length,
      cancelledCount: filteredBookings.filter((item) => String(item.status || "") === "cancelled")
        .length,
      checkedInCount: filteredBookings.filter((item) => String(item.status || "") === "checked_in")
        .length,
      totalBookingAmount: filteredBookings.reduce(
        (sum, item) => sum + Number(item.totalAmount || 0),
        0
      ),
      totalPayments: filteredPayments.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      ),
    }

    if (format === "csv") {
      await requirePermission(request, "export_reports")
      const rows = filteredBookings.map((item) => ({
        bookingId: String(item.id || ""),
        listingTitle: String(item.listingTitle || ""),
        branchName: String(item.branchName || ""),
        status: String(item.status || ""),
        paymentStatus: String(item.paymentStatus || ""),
        totalAmount: Number(item.totalAmount || 0),
        advancePaid: Number(item.advancePaid || 0),
        dueAmount: Number(item.dueAmount || 0),
        invoiceNumber: String(item.invoiceNumber || ""),
      }))
      const csv = toCsv(rows)
      await adminDb.collection("auditLogs").add({
        entity: "report",
        entityId: `receptionist_${Date.now()}`,
        action: "EXPORT_CSV",
        message: "Exported receptionist report CSV",
        payload: { dateFrom: dateFrom || null, dateTo: dateTo || null, ip: meta.ip, userAgent: meta.userAgent },
        createdBy: uid,
        createdAt: Timestamp.now(),
      })
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="receptionist-report-${Date.now()}.csv"`,
        },
      })
    }

    if (format === "pdf") {
      await requirePermission(request, "export_reports")
      const doc = new PDFDocument({ size: "A4", margin: 40 })
      const chunks: Uint8Array[] = []
      doc.on("data", (chunk: Buffer) => chunks.push(chunk))
      const done = new Promise<Buffer>((resolve) => {
        doc.on("end", () => resolve(Buffer.concat(chunks.map((item) => Buffer.from(item)))))
      })

      doc.fontSize(18).text("Receptionist Operational Report")
      doc.moveDown(0.5)
      doc.fontSize(10).text(`Generated: ${new Date().toLocaleString("en-IN")}`)
      if (dateFrom || dateTo) {
        doc.text(`Range: ${dateFrom || "start"} to ${dateTo || "end"}`)
      }
      doc.moveDown()
      doc.fontSize(12).text("Summary", { underline: true })
      doc.moveDown(0.3)
      doc.fontSize(10).text(`Bookings: ${summary.bookingCount}`)
      doc.text(`Cancelled: ${summary.cancelledCount}`)
      doc.text(`Checked-in: ${summary.checkedInCount}`)
      doc.text(`Booking Amount: INR ${summary.totalBookingAmount.toLocaleString("en-IN")}`)
      doc.text(`Payments: INR ${summary.totalPayments.toLocaleString("en-IN")}`)
      doc.moveDown()
      doc.fontSize(12).text("Recent Bookings", { underline: true })
      doc.moveDown(0.3)
      filteredBookings.slice(0, 30).forEach((item, index) => {
        doc
          .fontSize(9)
          .text(
            `${index + 1}. ${String(item.listingTitle || "-")} | ${String(item.status || "-")} | INR ${Number(item.totalAmount || 0).toLocaleString("en-IN")} | ${String(item.invoiceNumber || "-")}`
          )
      })
      doc.end()
      const pdfBuffer = await done
      await adminDb.collection("auditLogs").add({
        entity: "report",
        entityId: `receptionist_${Date.now()}`,
        action: "EXPORT_PDF",
        message: "Exported receptionist report PDF",
        payload: { dateFrom: dateFrom || null, dateTo: dateTo || null, ip: meta.ip, userAgent: meta.userAgent },
        createdBy: uid,
        createdAt: Timestamp.now(),
      })
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="receptionist-report-${Date.now()}.pdf"`,
        },
      })
    }

    await adminDb.collection("auditLogs").add({
      entity: "report",
      entityId: `receptionist_${Date.now()}`,
      action: "VIEW",
      message: "Viewed receptionist report",
      payload: { dateFrom: dateFrom || null, dateTo: dateTo || null, ip: meta.ip, userAgent: meta.userAgent },
      createdBy: uid,
      createdAt: Timestamp.now(),
    })
    return NextResponse.json({
      summary,
      bookings: filteredBookings.slice(0, 100),
      payments: filteredPayments.slice(0, 100),
    })
  } catch (error) {
    const mapped = toHttpError(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}
