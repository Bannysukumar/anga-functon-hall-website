"use client"

import { useEffect, useState } from "react"
import { PermissionGuard } from "@/components/auth/permission-guard"
import { useAuth } from "@/lib/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

type ReportData = {
  summary: {
    bookingCount: number
    cancelledCount: number
    checkedInCount: number
    totalBookingAmount: number
    totalPayments: number
  }
}

export default function ReceptionistReportsPage() {
  const { user, hasPermission, isAdminUser } = useAuth()
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [report, setReport] = useState<ReportData | null>(null)

  async function loadReport() {
    if (!user) return
    try {
      const response = await fetch(
        `/api/receptionist/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { headers: { Authorization: `Bearer ${await user.getIdToken()}` } }
      )
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to load report")
      setReport(json as ReportData)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load report")
    }
  }

  useEffect(() => {
    loadReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function exportCsv() {
    if (!user) return
    try {
      const response = await fetch(
        `/api/receptionist/reports?format=csv&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { headers: { Authorization: `Bearer ${await user.getIdToken()}` } }
      )
      if (!response.ok) {
        const json = await response.json()
        throw new Error(json.error || "Failed to export CSV")
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `receptionist-report-${Date.now()}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast.success("CSV exported")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export CSV")
    }
  }

  async function exportPdf() {
    if (!user) return
    try {
      const response = await fetch(
        `/api/receptionist/reports?format=pdf&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { headers: { Authorization: `Bearer ${await user.getIdToken()}` } }
      )
      if (!response.ok) {
        const json = await response.json()
        throw new Error(json.error || "Failed to export PDF")
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `receptionist-report-${Date.now()}.pdf`
      link.click()
      URL.revokeObjectURL(url)
      toast.success("PDF exported")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export PDF")
    }
  }

  return (
    <PermissionGuard requiredPermissions={["view_reports"]} allowedRoles={["admin", "receptionist"]}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground">Operational reports for receptionist desk.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            <Button variant="outline" onClick={loadReport}>
              Apply
            </Button>
            <div className="flex gap-2">
              <Button
                onClick={exportCsv}
                disabled={!isAdminUser && !hasPermission("export_reports")}
                title={
                  !isAdminUser && !hasPermission("export_reports")
                    ? "Export permission not granted by admin."
                    : "Export CSV"
                }
              >
                Export CSV
              </Button>
              <Button
                variant="outline"
                onClick={exportPdf}
                disabled={!isAdminUser && !hasPermission("export_reports")}
                title={
                  !isAdminUser && !hasPermission("export_reports")
                    ? "Export permission not granted by admin."
                    : "Export PDF"
                }
              >
                Export PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Bookings</p>
              <p className="text-lg font-semibold">{report?.summary.bookingCount || 0}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Cancelled</p>
              <p className="text-lg font-semibold">{report?.summary.cancelledCount || 0}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Checked-in</p>
              <p className="text-lg font-semibold">{report?.summary.checkedInCount || 0}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Booking Amount</p>
              <p className="text-lg font-semibold">
                ₹{Number(report?.summary.totalBookingAmount || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Payments</p>
              <p className="text-lg font-semibold">
                ₹{Number(report?.summary.totalPayments || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Print</p>
              <Button size="sm" variant="outline" onClick={() => window.print()}>
                Print View
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  )
}
