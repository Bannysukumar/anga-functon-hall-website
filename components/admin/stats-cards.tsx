"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Building,
  ListChecks,
  BookOpen,
  CreditCard,
  CalendarCheck,
  XCircle,
  Clock,
  Users,
  Wallet,
} from "lucide-react"

export function StatsCards({
  branchCount,
  listingCount,
  bookingCount,
  revenue,
  confirmedCount = 0,
  cancelledCount = 0,
  pendingCount = 0,
  userCount = 0,
  dueAmount = 0,
}: {
  branchCount: number
  listingCount: number
  bookingCount: number
  revenue: number
  confirmedCount?: number
  cancelledCount?: number
  pendingCount?: number
  userCount?: number
  dueAmount?: number
}) {
  const primaryStats = [
    {
      title: "Branches",
      value: branchCount,
      icon: Building,
      color: "text-chart-1",
      bg: "bg-chart-1/10",
    },
    {
      title: "Listings",
      value: listingCount,
      icon: ListChecks,
      color: "text-chart-2",
      bg: "bg-chart-2/10",
    },
    {
      title: "Bookings",
      value: bookingCount,
      icon: BookOpen,
      color: "text-chart-3",
      bg: "bg-chart-3/10",
    },
    {
      title: "Revenue (collected)",
      value: `₹${revenue.toLocaleString("en-IN")}`,
      icon: CreditCard,
      color: "text-chart-4",
      bg: "bg-chart-4/10",
    },
  ]

  const bookingStats = [
    {
      title: "Confirmed",
      value: confirmedCount,
      icon: CalendarCheck,
      color: "text-emerald-600",
      bg: "bg-emerald-500/10",
    },
    {
      title: "Cancelled",
      value: cancelledCount,
      icon: XCircle,
      color: "text-rose-600",
      bg: "bg-rose-500/10",
    },
    {
      title: "Pending",
      value: pendingCount,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-500/10",
    },
    {
      title: "Users",
      value: userCount,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-500/10",
    },
    {
      title: "Due amount",
      value: `₹${dueAmount.toLocaleString("en-IN")}`,
      icon: Wallet,
      color: "text-violet-600",
      bg: "bg-violet-500/10",
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {primaryStats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`rounded-lg p-2 ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">
          Bookings & users
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {bookingStats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`rounded-lg p-2 ${stat.bg}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
