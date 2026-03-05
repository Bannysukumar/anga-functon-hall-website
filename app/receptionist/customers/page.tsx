"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { PermissionGuard } from "@/components/auth/permission-guard"
import { useAuth } from "@/lib/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

type Customer = {
  id: string
  name: string
  phone: string
  email?: string
  address?: string
  notes?: string
  isActive?: boolean
}

export default function ReceptionistCustomersPage() {
  const { user, hasPermission, isAdminUser } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [creatingCustomer, setCreatingCustomer] = useState(false)
  const [resendingCredentialsFor, setResendingCredentialsFor] = useState("")
  const [createCustomerMessage, setCreateCustomerMessage] = useState("")
  const [createCustomerError, setCreateCustomerError] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  })

  async function fetchCustomers() {
    if (!user) return
    setLoading(true)
    try {
      const response = await fetch(
        `/api/receptionist/customers?search=${encodeURIComponent(search)}&limit=100`,
        {
          headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        }
      )
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to fetch customers")
      setCustomers(json.items || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch customers")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    setPage(1)
  }, [search, customers.length])

  async function createCustomer() {
    if (!user) {
      const message = "You are not logged in. Please sign in again."
      setCreateCustomerError(true)
      setCreateCustomerMessage(message)
      toast.error(message)
      return
    }
    if (creatingCustomer) return
    const name = form.name.trim()
    const phone = form.phone.trim()
    const email = form.email.trim()
    const address = form.address.trim()
    const notes = form.notes.trim()

    if (!name || name.length > 120) {
      const message = "Name is required (max 120 characters)."
      setCreateCustomerError(true)
      setCreateCustomerMessage(message)
      toast.error(message)
      return
    }
    if (phone.length < 6 || phone.length > 20) {
      const message = "Phone must be between 6 and 20 characters."
      setCreateCustomerError(true)
      setCreateCustomerMessage(message)
      toast.error(message)
      return
    }
    if (!email) {
      const message = "Email is required to create login credentials."
      setCreateCustomerError(true)
      setCreateCustomerMessage(message)
      toast.error(message)
      return
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const message = "Enter a valid email address."
      setCreateCustomerError(true)
      setCreateCustomerMessage(message)
      toast.error(message)
      return
    }
    if (email.length > 200 || address.length > 300 || notes.length > 500) {
      const message = "Email/address/notes exceed allowed length."
      setCreateCustomerError(true)
      setCreateCustomerMessage(message)
      toast.error(message)
      return
    }

    setCreateCustomerError(false)
    setCreateCustomerMessage("")
    setCreatingCustomer(true)
    try {
      const response = await fetch("/api/receptionist/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({ name, phone, email, address, notes }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to create customer")
      toast.success("Customer created. Login credentials sent to email.")
      setCreateCustomerError(false)
      setCreateCustomerMessage("Customer created and temporary password email sent.")
      setForm({ name: "", phone: "", email: "", address: "", notes: "" })
      fetchCustomers()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create customer"
      setCreateCustomerError(true)
      setCreateCustomerMessage(message)
      toast.error(message)
    } finally {
      setCreatingCustomer(false)
    }
  }

  async function toggleActive(customer: Customer) {
    if (!user) return
    const nextState = customer.isActive === false ? "enable" : "disable"
    const confirmed = window.confirm(`Are you sure you want to ${nextState} this customer?`)
    if (!confirmed) return
    try {
      const response = await fetch(`/api/receptionist/customers/${customer.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({ isActive: !customer.isActive }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to update customer")
      toast.success("Customer updated")
      fetchCustomers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update customer")
    }
  }

  async function resendCredentials(customer: Customer) {
    if (!user) {
      toast.error("You are not logged in. Please sign in again.")
      return
    }
    if (!customer.email) {
      toast.error("Customer email is missing.")
      return
    }
    if (resendingCredentialsFor) return
    setResendingCredentialsFor(customer.id)
    try {
      const response = await fetch(`/api/receptionist/customers/${customer.id}/resend-credentials`, {
        method: "POST",
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to resend credentials")
      toast.success("Temporary password sent to customer email.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resend credentials")
    } finally {
      setResendingCredentialsFor("")
    }
  }

  const totalPages = Math.max(1, Math.ceil(customers.length / pageSize))
  const pagedCustomers = customers.slice((page - 1) * pageSize, page * pageSize)

  return (
    <PermissionGuard requiredPermissions={["view_customers"]} allowedRoles={["admin", "receptionist"]}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground">Search and manage customer records.</p>
        </div>

        {(isAdminUser || hasPermission("create_customer")) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add Customer</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Login credentials will be sent to this email.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Button onClick={createCustomer} disabled={creatingCustomer}>
                  {creatingCustomer ? "Creating..." : "Create Customer"}
                </Button>
                {createCustomerMessage && (
                  <p
                    className={`mt-2 text-sm ${
                      createCustomerError ? "text-destructive" : "text-green-600"
                    }`}
                  >
                    {createCustomerMessage}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer List</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Search name / phone / email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Button variant="outline" onClick={fetchCustomers}>
                Search
              </Button>
            </div>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : customers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No customers found.</p>
            ) : (
              <div className="space-y-2">
                {pagedCustomers.map((customer) => (
                  <div key={customer.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {customer.phone} {customer.email ? `| ${customer.email}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/receptionist/customers/${customer.id}`}>View</Link>
                        </Button>
                        {(isAdminUser || hasPermission("edit_customer")) && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              !customer.email || resendingCredentialsFor === customer.id
                            }
                            onClick={() => resendCredentials(customer)}
                          >
                            {resendingCredentialsFor === customer.id
                              ? "Sending..."
                              : "Resend Credentials"}
                          </Button>
                        )}
                        {(isAdminUser || hasPermission("edit_customer")) && (
                          <Button
                            size="sm"
                            variant={customer.isActive === false ? "default" : "outline"}
                            onClick={() => toggleActive(customer)}
                          >
                            {customer.isActive === false ? "Enable" : "Disable"}
                          </Button>
                        )}
                      </div>
                    </div>
                    {customer.address && (
                      <p className="mt-2 text-xs text-muted-foreground">{customer.address}</p>
                    )}
                    {customer.notes && (
                      <p className="mt-1 text-xs text-muted-foreground">{customer.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {customers.length > pageSize && (
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    Prev
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  )
}
