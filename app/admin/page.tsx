"use client"

import { useEffect, useState } from "react"
import { getBranches, getListings, getBookings } from "@/lib/firebase-db"
import { StatsCards } from "@/components/admin/stats-cards"
import { Spinner } from "@/components/ui/spinner"

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    branchCount: 0,
    listingCount: 0,
    bookingCount: 0,
    revenue: 0,
  })

  useEffect(() => {
    async function loadStats() {
      try {
        const [branches, listings, bookings] = await Promise.all([
          getBranches(),
          getListings(),
          getBookings(),
        ])
        const revenue = bookings.reduce(
          (sum, b) => sum + (b.advancePaid || 0),
          0
        )
        setStats({
          branchCount: branches.length,
          listingCount: listings.length,
          bookingCount: bookings.length,
          revenue,
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
      <StatsCards {...stats} />
    </div>
  )
}
