import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function DashboardOperationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Operations</h1>
        <p className="text-sm text-muted-foreground">
          Use your permitted operational modules.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manage Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/operations/bookings">Open</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manage Listings</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/operations/listings">Open</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/operations/settings">Open</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/operations/attendance">Open</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
