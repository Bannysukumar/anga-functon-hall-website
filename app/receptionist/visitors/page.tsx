"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { PermissionGuard } from "@/components/auth/permission-guard"
import { useAuth } from "@/lib/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getListings } from "@/lib/firebase-db"
import type { Listing } from "@/lib/types"
import { toast } from "sonner"

type VisitorLead = {
  id: string
  name: string
  phone: string
  eventType: string
  preferredDate: string
  notes: string
  status: "new" | "follow_up" | "interested" | "converted" | "not_interested"
  convertedBookingId?: string | null
}

const STATUS_OPTIONS = ["all", "new", "follow_up", "interested", "converted", "not_interested"] as const

export default function ReceptionistVisitorsPage() {
  const { user, hasPermission, isAdminUser } = useAuth()
  const [items, setItems] = useState<VisitorLead[]>([])
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("all")
  const [search, setSearch] = useState("")
  const [eventType, setEventType] = useState("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [creating, setCreating] = useState(false)
  const [convertingLead, setConvertingLead] = useState<VisitorLead | null>(null)
  const [convertSubmitting, setConvertSubmitting] = useState(false)
  const [listings, setListings] = useState<Listing[]>([])
  const [form, setForm] = useState({
    name: "",
    phone: "",
    eventType: "function_hall",
    preferredDate: "",
    notes: "",
  })
  const [convertForm, setConvertForm] = useState({
    listingId: "",
    functionDateTime: "",
    guestCount: 1,
    totalAmount: 1000,
    advanceAmount: 0,
    paymentMethod: "cash",
    notes: "",
  })

  async function loadVisitors() {
    if (!user) return
    try {
      const response = await fetch(
        `/api/receptionist/visitors?status=${status}&eventType=${eventType}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&search=${encodeURIComponent(search)}&limit=200`,
        { headers: { Authorization: `Bearer ${await user.getIdToken()}` } }
      )
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to load visitors")
      setItems(json.items || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load visitors")
    }
  }

  useEffect(() => {
    loadVisitors()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, status, eventType, from, to])

  useEffect(() => {
    getListings().then(setListings).catch(() => setListings([]))
  }, [])

  async function createVisitor() {
    if (!user || creating) return
    if (!form.name || !form.phone || !form.preferredDate) {
      toast.error("Name, phone and preferred date are required.")
      return
    }
    setCreating(true)
    try {
      const response = await fetch("/api/receptionist/visitors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify(form),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to create visitor")
      toast.success("Visitor lead added")
      setForm({ name: "", phone: "", eventType: "function_hall", preferredDate: "", notes: "" })
      loadVisitors()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create visitor")
    } finally {
      setCreating(false)
    }
  }

  async function updateStatus(id: string, nextStatus: VisitorLead["status"]) {
    if (!user) return
    try {
      const response = await fetch(`/api/receptionist/visitors/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to update status")
      loadVisitors()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status")
    }
  }

  function openConvertModal(item: VisitorLead) {
    setConvertingLead(item)
    setConvertForm({
      listingId: "",
      functionDateTime: `${item.preferredDate}T10:00`,
      guestCount: 1,
      totalAmount: 1000,
      advanceAmount: 0,
      paymentMethod: "cash",
      notes: `Converted from visitor lead ${item.id}`,
    })
  }

  async function convertToBooking() {
    if (!user || !convertingLead || convertSubmitting) return
    if (!convertForm.listingId || !convertForm.functionDateTime || convertForm.totalAmount <= 0) {
      toast.error("Listing, date/time and total amount are required.")
      return
    }
    setConvertSubmitting(true)
    try {
      const response = await fetch(`/api/receptionist/visitors/${convertingLead.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({
          listingId: convertForm.listingId,
          functionDateTime: convertForm.functionDateTime ? format(new Date(convertForm.functionDateTime), "yyyy-MM-dd'T'HH:mm:ssXXX") : "",
          totalAmount: Number(convertForm.totalAmount || 0),
          advanceAmount: Number(convertForm.advanceAmount || 0),
          guestCount: Number(convertForm.guestCount || 1),
          paymentMethod: convertForm.paymentMethod,
          notes: convertForm.notes,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to convert lead")
      toast.success("Lead converted to booking")
      setConvertingLead(null)
      loadVisitors()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to convert lead")
    } finally {
      setConvertSubmitting(false)
    }
  }

  return (
    <PermissionGuard requiredPermissions={["manage_visitors"]} allowedRoles={["admin", "receptionist"]}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Walk-in Visitor Log</h1>
          <p className="text-sm text-muted-foreground">Lead management with quick convert-to-booking actions.</p>
        </div>

        {(isAdminUser || hasPermission("manage_visitors")) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add Visitor Lead</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Visitor Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Phone Number</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Interested Event Type</Label>
                <Input value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Preferred Event Date</Label>
                <Input type="date" value={form.preferredDate} onChange={(e) => setForm({ ...form, preferredDate: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Button onClick={createVisitor} disabled={creating}>{creating ? "Saving..." : "Add Lead"}</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Visitor Leads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-6">
              <Input placeholder="Search name / phone / notes" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="h-9 rounded-md border px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value as (typeof STATUS_OPTIONS)[number])}>
                {STATUS_OPTIONS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <Input placeholder="Event type (or all)" value={eventType} onChange={(e) => setEventType(e.target.value || "all")} />
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              <Button variant="outline" onClick={loadVisitors}>Apply</Button>
            </div>

            <div className="space-y-2">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No visitor leads found.</p>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{item.name} ({item.phone})</p>
                        <p className="text-xs text-muted-foreground">
                          {item.eventType} | Preferred: {item.preferredDate} | Status: {item.status}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" asChild>
                          <a href={`tel:${item.phone}`}>Call</a>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <a href={`https://wa.me/${item.phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer">
                            WhatsApp
                          </a>
                        </Button>
                        {item.status !== "converted" && (
                          <Button size="sm" onClick={() => openConvertModal(item)}>
                            Convert to Booking
                          </Button>
                        )}
                        <select
                          className="h-8 rounded-md border px-2 text-xs"
                          value={item.status}
                          onChange={(e) => updateStatus(item.id, e.target.value as VisitorLead["status"])}
                        >
                          <option value="new">new</option>
                          <option value="follow_up">follow_up</option>
                          <option value="interested">interested</option>
                          <option value="converted">converted</option>
                          <option value="not_interested">not_interested</option>
                        </select>
                      </div>
                    </div>
                    {item.notes && <p className="mt-2 text-xs text-muted-foreground">{item.notes}</p>}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <Dialog open={Boolean(convertingLead)} onOpenChange={(open) => !open && setConvertingLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert Lead to Booking</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Listing</Label>
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={convertForm.listingId}
                onChange={(e) => setConvertForm({ ...convertForm, listingId: e.target.value })}
              >
                <option value="">Select listing</option>
                {listings.map((listing) => (
                  <option key={listing.id} value={listing.id}>
                    {listing.title} ({listing.type})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Function Date/Time</Label>
              <Input
                type="datetime-local"
                value={convertForm.functionDateTime}
                onChange={(e) => setConvertForm({ ...convertForm, functionDateTime: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Guest Count</Label>
              <Input
                type="number"
                min={1}
                value={convertForm.guestCount}
                onChange={(e) => setConvertForm({ ...convertForm, guestCount: Number(e.target.value || 1) })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Total Amount</Label>
              <Input
                type="number"
                min={1}
                value={convertForm.totalAmount}
                onChange={(e) => setConvertForm({ ...convertForm, totalAmount: Number(e.target.value || 0) })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Advance Amount</Label>
              <Input
                type="number"
                min={0}
                value={convertForm.advanceAmount}
                onChange={(e) => setConvertForm({ ...convertForm, advanceAmount: Number(e.target.value || 0) })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Payment Method</Label>
              <Input
                value={convertForm.paymentMethod}
                onChange={(e) => setConvertForm({ ...convertForm, paymentMethod: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={convertForm.notes}
                onChange={(e) => setConvertForm({ ...convertForm, notes: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Button onClick={convertToBooking} disabled={convertSubmitting}>
                {convertSubmitting ? "Converting..." : "Convert to Booking"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PermissionGuard>
  )
}
