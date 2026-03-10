"use client"

import {
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from "@/lib/firebase-db"
import type { Coupon } from "@/lib/types"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Switch } from "@/components/ui/switch"
import {
  Loader2,
  Plus,
  Trash2,
  Ticket,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Timestamp } from "firebase/firestore"

export default function AdminCouponsPage() {
  const { toast } = useToast()
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [code, setCode] = useState("")
  const [rewardMode, setRewardMode] = useState<"discount" | "cashback">("discount")
  const [discountType, setDiscountType] = useState<"flat" | "percent">("flat")
  const [discountValue, setDiscountValue] = useState("")
  const [cashbackType, setCashbackType] = useState<"flat" | "percent">("flat")
  const [cashbackValue, setCashbackValue] = useState("")
  const [maxCashbackAmount, setMaxCashbackAmount] = useState("")
  const [minOrderAmount, setMinOrderAmount] = useState("")
  const [maxUses, setMaxUses] = useState("")
  const [validFrom, setValidFrom] = useState("")
  const [validUntil, setValidUntil] = useState("")

  const loadCoupons = async () => {
    setLoading(true)
    try {
      const data = await getCoupons()
      setCoupons(data)
    } catch (err) {
      console.error("Error loading coupons:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCoupons()
  }, [])

  const resetForm = () => {
    setCode("")
    setRewardMode("discount")
    setDiscountType("flat")
    setDiscountValue("")
    setCashbackType("flat")
    setCashbackValue("")
    setMaxCashbackAmount("")
    setMinOrderAmount("")
    setMaxUses("")
    setValidFrom("")
    setValidUntil("")
  }

  const handleCreate = async () => {
    if (!code || !validFrom || !validUntil || (rewardMode === "discount" && !discountValue) || (rewardMode === "cashback" && !cashbackValue)) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      await createCoupon({
        code: code.toUpperCase(),
        rewardMode,
        discountType,
        discountValue: Number(discountValue) || 0,
        cashbackType,
        cashbackValue: Number(cashbackValue) || 0,
        maxCashbackAmount: Number(maxCashbackAmount) || 0,
        minOrderAmount: Number(minOrderAmount) || 0,
        maxUses: Number(maxUses) || 999,
        validFrom: Timestamp.fromDate(new Date(validFrom)),
        validUntil: Timestamp.fromDate(new Date(validUntil)),
        isActive: true,
      })
      toast({ title: "Coupon created" })
      setDialogOpen(false)
      resetForm()
      loadCoupons()
    } catch {
      toast({
        title: "Error",
        description: "Failed to create coupon.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (coupon: Coupon) => {
    try {
      await updateCoupon(coupon.id, { isActive: !coupon.isActive })
      loadCoupons()
    } catch {
      toast({
        title: "Error",
        description: "Failed to update coupon.",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteCoupon(id)
      toast({ title: "Coupon deleted" })
      loadCoupons()
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete coupon.",
        variant: "destructive",
      })
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Coupons</h1>
          <p className="text-sm text-muted-foreground">
            Manage discount coupons
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Coupon
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Coupon</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="code">Coupon Code</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. WELCOME20"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Reward Mode</Label>
                  <Select
                    value={rewardMode}
                    onValueChange={(v) => setRewardMode(v as "discount" | "cashback")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="discount">Discount</SelectItem>
                      <SelectItem value="cashback">Wallet Cashback</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Discount Type</Label>
                  <Select
                    value={discountType}
                    onValueChange={(v) => setDiscountType(v as "flat" | "percent")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat (INR)</SelectItem>
                      <SelectItem value="percent">Percentage (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="discountValue">Value</Label>
                  <Input
                    id="discountValue"
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={discountType === "flat" ? "500" : "20"}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="minOrder">Min Order (INR)</Label>
                  <Input
                    id="minOrder"
                    type="number"
                    value={minOrderAmount}
                    onChange={(e) => setMinOrderAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Cashback Type</Label>
                  <Select
                    value={cashbackType}
                    onValueChange={(v) => setCashbackType(v as "flat" | "percent")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat (INR)</SelectItem>
                      <SelectItem value="percent">Percentage (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cashbackValue">Cashback Value</Label>
                  <Input
                    id="cashbackValue"
                    type="number"
                    value={cashbackValue}
                    onChange={(e) => setCashbackValue(e.target.value)}
                    placeholder={cashbackType === "flat" ? "50" : "10"}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="maxCashbackAmount">Max Cashback</Label>
                  <Input
                    id="maxCashbackAmount"
                    type="number"
                    value={maxCashbackAmount}
                    onChange={(e) => setMaxCashbackAmount(e.target.value)}
                    placeholder="100"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="maxUses">Max Uses</Label>
                  <Input
                    id="maxUses"
                    type="number"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    placeholder="100"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="validFrom">Valid From</Label>
                  <Input
                    id="validFrom"
                    type="date"
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="validUntil">Valid Until</Label>
                  <Input
                    id="validUntil"
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleCreate} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Coupon
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Ticket className="h-4 w-4" />
            All Coupons ({coupons.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Min Order</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Validity</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No coupons created yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  coupons.map((coupon) => {
                    const fromDate = coupon.validFrom?.toDate
                      ? coupon.validFrom
                          .toDate()
                          .toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })
                      : "N/A"
                    const untilDate = coupon.validUntil?.toDate
                      ? coupon.validUntil
                          .toDate()
                          .toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })
                      : "N/A"

                    return (
                      <TableRow key={coupon.id}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {coupon.code}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-foreground">
                          {coupon.rewardMode === "cashback"
                            ? `Cashback ${coupon.cashbackType === "flat" ? `₹${coupon.cashbackValue || 0}` : `${coupon.cashbackValue || 0}%`}`
                            : coupon.discountType === "flat"
                              ? `₹${coupon.discountValue}`
                              : `${coupon.discountValue}%`}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {"₹"}{coupon.minOrderAmount}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {coupon.usedCount} / {coupon.maxUses}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {fromDate} - {untilDate}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={coupon.isActive}
                            onCheckedChange={() => handleToggle(coupon)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete coupon {coupon.code}?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(coupon.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
