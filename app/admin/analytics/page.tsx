"use client"

import { useEffect, useState, useMemo } from "react"
import { getBookings, getListings, getBranches, getAllUsers } from "@/lib/firebase-db"
import type { Booking, Listing, Branch, AppUser } from "@/lib/types"
import { LISTING_TYPE_LABELS, BOOKING_STATUS_LABELS } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts"
import {
  Loader2,
  TrendingUp,
  Users,
  IndianRupee,
  CalendarCheck,
  Building,
  BarChart3,
} from "lucide-react"

const COLORS = [
  "oklch(0.45 0.15 250)",
  "oklch(0.72 0.14 55)",
  "oklch(0.55 0.12 160)",
  "oklch(0.65 0.18 35)",
  "oklch(0.6 0.15 300)",
  "oklch(0.5 0.15 210)",
]

export default function AdminAnalyticsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [b, l, br, u] = await Promise.all([
          getBookings(),
          getListings(),
          getBranches(),
          getAllUsers(),
        ])
        setBookings(b)
        setListings(l)
        setBranches(br)
        setUsers(u)
      } catch (err) {
        console.error("Error loading analytics:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totalRevenue = useMemo(
    () =>
      bookings
        .filter((b) => b.status !== "cancelled")
        .reduce((sum, b) => sum + (b.totalAmount || 0), 0),
    [bookings]
  )

  const confirmedBookings = bookings.filter(
    (b) => b.status === "confirmed" || b.status === "completed"
  ).length

  // Revenue by month (last 6 months)
  const revenueByMonth = useMemo(() => {
    const months: { month: string; revenue: number }[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const label = d.toLocaleDateString("en-IN", {
        month: "short",
        year: "2-digit",
      })
      const revenue = bookings
        .filter((b) => {
          if (b.status === "cancelled") return false
          const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : null
          if (!bDate) return false
          const bKey = `${bDate.getFullYear()}-${String(bDate.getMonth() + 1).padStart(2, "0")}`
          return bKey === key
        })
        .reduce((sum, b) => sum + (b.totalAmount || 0), 0)
      months.push({ month: label, revenue })
    }
    return months
  }, [bookings])

  // Bookings by listing type
  const bookingsByType = useMemo(() => {
    const counts: Record<string, number> = {}
    bookings.forEach((b) => {
      const label = LISTING_TYPE_LABELS[b.listingType] || b.listingType
      counts[label] = (counts[label] || 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [bookings])

  // Bookings by status
  const bookingsByStatus = useMemo(() => {
    const counts: Record<string, number> = {}
    bookings.forEach((b) => {
      const label = BOOKING_STATUS_LABELS[b.status] || b.status
      counts[label] = (counts[label] || 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [bookings])

  // Branch performance
  const branchPerformance = useMemo(() => {
    const revenue: Record<string, number> = {}
    bookings
      .filter((b) => b.status !== "cancelled")
      .forEach((b) => {
        const name = b.branchName || "Unknown"
        revenue[name] = (revenue[name] || 0) + (b.totalAmount || 0)
      })
    return Object.entries(revenue)
      .map(([branch, revenue]) => ({ branch, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
  }, [bookings])

  const revenueChartConfig: ChartConfig = {
    revenue: {
      label: "Revenue",
      color: "oklch(0.45 0.15 250)",
    },
  }

  const branchChartConfig: ChartConfig = {
    revenue: {
      label: "Revenue",
      color: "oklch(0.72 0.14 55)",
    },
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your business performance
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <IndianRupee className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold text-foreground">
                {"₹"}{totalRevenue.toLocaleString("en-IN")}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100">
              <CalendarCheck className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Confirmed Bookings</p>
              <p className="text-2xl font-bold text-foreground">
                {confirmedBookings}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100">
              <Building className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Listings</p>
              <p className="text-2xl font-bold text-foreground">
                {listings.filter((l) => l.isActive).length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-100">
              <Users className="h-6 w-6 text-sky-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Users</p>
              <p className="text-2xl font-bold text-foreground">
                {users.length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Revenue Trend (6 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={revenueChartConfig} className="h-[300px] w-full">
              <LineChart data={revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-revenue)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Branch Revenue */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Revenue by Branch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={branchChartConfig} className="h-[300px] w-full">
              <BarChart data={branchPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="branch" fontSize={12} />
                <YAxis fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Bookings by Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bookings by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="mx-auto h-[300px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={bookingsByType}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {bookingsByType.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Bookings by Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bookings by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="mx-auto h-[300px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={bookingsByStatus}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {bookingsByStatus.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
