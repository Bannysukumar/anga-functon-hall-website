"use client"

import { useEffect, useState } from "react"
import { getBranches, getListings, getBookings, getAllUsers } from "@/lib/firebase-db"
import { StatsCards } from "@/components/admin/stats-cards"
import { Spinner } from "@/components/ui/spinner"

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    branchCount: 0,
    listingCount: 0,
    bookingCount: 0,
    revenue: 0,
    confirmedCount: 0,
    cancelledCount: 0,
    pendingCount: 0,
    userCount: 0,
    dueAmount: 0,
    refundRequestCount: 0,
  })

  useEffect(() => {
    async function loadStats() {
      try {
        const [branches, listings, bookings, users] = await Promise.all([
          getBranches(),
          getListings(),
          getBookings(),
          getAllUsers(),
        ])
        const revenue = bookings.reduce(
          (sum, b) => sum + (b.advancePaid || 0),
          0
        )
        const dueAmount = bookings
          .filter((b) => b.status !== "cancelled")
          .reduce((sum, b) => sum + (b.dueAmount || 0), 0)
        const refundRequestCount = bookings.filter(
          (b) =>
            b.status === "cancelled" &&
            (b.refundStatus === "refund_requested" || b.refundStatus === "requested") &&
            Number(b.advancePaid || 0) > 0
        ).length
        setStats({
          branchCount: branches.length,
          listingCount: listings.length,
          bookingCount: bookings.length,
          revenue,
          confirmedCount: bookings.filter((b) => b.status === "confirmed").length,
          cancelledCount: bookings.filter((b) => b.status === "cancelled").length,
          pendingCount: bookings.filter((b) => b.status === "pending").length,
          userCount: users.length,
          dueAmount,
          refundRequestCount,
        })
      } catch {
        // Stats will show 0
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your venue management system
        </p>
      </div>
      {stats.refundRequestCount > 0 && (
        <a
          href="/admin/refunds"
          className="block rounded-lg border border-orange-200 bg-orange-50 p-4 text-orange-900 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-200"
        >
          <p className="font-medium">
            {stats.refundRequestCount} refund request(s) pending review
          </p>
          <p className="text-sm opacity-90">View and process in Refunds</p>
        </a>
      )}
      <StatsCards {...stats} />
    </div>
  )
}
