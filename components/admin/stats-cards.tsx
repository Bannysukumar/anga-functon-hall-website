"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building, ListChecks, BookOpen, CreditCard } from "lucide-react"

export function StatsCards({
  branchCount,
  listingCount,
  bookingCount,
  revenue,
}: {
  branchCount: number
  listingCount: number
  bookingCount: number
  revenue: number
}) {
  const stats = [
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
      title: "Revenue",
      value: `₹${revenue.toLocaleString("en-IN")}`,
      icon: CreditCard,
      color: "text-chart-4",
      bg: "bg-chart-4/10",
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
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
  )
}
