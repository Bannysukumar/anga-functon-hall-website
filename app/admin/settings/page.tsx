"use client"

import { useEffect, useState } from "react"
import {
  createAuditLog,
  getSecureSettings,
  getSettings,
  updateSecureSettings,
  updateSettings,
} from "@/lib/firebase-db"
import type { SecureSettings, SiteSettings, SocialLink } from "@/lib/types"
import { DEFAULT_SETTINGS } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import {
  getBannerImagePath,
  getSiteLogoPath,
  uploadImage,
} from "@/lib/firebase-storage"
import { toast } from "sonner"
import { useAuth } from "@/lib/hooks/use-auth"
import { Plus, Trash2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import type { Permission } from "@/lib/types"

const RECEPTIONIST_PERMISSION_GROUPS: Array<{
  module: string
  permissions: Array<{ key: Permission; label: string }>
}> = [
  {
    module: "Dashboard",
    permissions: [{ key: "view_dashboard", label: "View Dashboard" }],
  },
  {
    module: "Bookings",
    permissions: [
      { key: "view_bookings", label: "View Bookings" },
      { key: "create_booking", label: "Create Booking" },
      { key: "edit_booking", label: "Edit Booking" },
      { key: "cancel_booking", label: "Cancel Booking" },
      { key: "check_in", label: "Check-in" },
      { key: "check_out", label: "Check-out" },
    ],
  },
  {
    module: "Customers",
    permissions: [
      { key: "view_customers", label: "View Customers" },
      { key: "create_customer", label: "Create Customer" },
      { key: "edit_customer", label: "Edit Customer" },
    ],
  },
  {
    module: "Payments",
    permissions: [
      { key: "view_payments", label: "View Payments" },
      { key: "create_payment_receipt", label: "Create Payment Receipt" },
    ],
  },
  {
    module: "Rooms",
    permissions: [{ key: "view_rooms", label: "View Rooms / Availability" }],
  },
  {
    module: "Reports",
    permissions: [
      { key: "view_reports", label: "View Reports" },
      { key: "export_reports", label: "Export Reports" },
    ],
  },
  {
    module: "Productivity",
    permissions: [
      { key: "view_calendar", label: "View Booking Calendar" },
      { key: "manage_visitors", label: "Manage Visitor Leads" },
      { key: "send_whatsapp", label: "Send WhatsApp Messages" },
      { key: "manage_payment_reminders", label: "Manage Payment Reminders" },
    ],
  },
  {
    module: "Settings",
    permissions: [{ key: "view_settings", label: "View Settings" }],
  },
]

export default function SettingsPage() {
  const { user, isAdminUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingBannerIndex, setUploadingBannerIndex] = useState<number | null>(null)
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS)
  const [secureSettings, setSecureSettings] = useState<SecureSettings>({
    razorpaySecretKey: "",
    razorpayWebhookSecret: "",
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: "",
    smtpPass: "",
    smtpFromName: "",
    smtpFromEmail: "",
    adminNotificationEmail: "",
    appBaseUrl: "",
  })

  useEffect(() => {
    async function load() {
      try {
        const [data, secureData] = await Promise.all([
          getSettings(),
          isAdminUser
            ? getSecureSettings()
            : Promise.resolve({
                razorpaySecretKey: "",
                smtpHost: "",
                smtpPort: 587,
                smtpSecure: false,
                smtpUser: "",
                smtpPass: "",
                smtpFromName: "",
                smtpFromEmail: "",
                adminNotificationEmail: "",
                appBaseUrl: "",
              }),
        ])
        setSettings(data)
        setSecureSettings(secureData)
      } catch {
        // Use defaults
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isAdminUser])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!isAdminUser) {
      toast.error("Only admin can update settings.")
      return
    }
    setSaving(true)
    try {
      await updateSettings(settings)
      if (isAdminUser) {
        await updateSecureSettings(secureSettings)
      }
      if (isAdminUser) {
        try {
          await createAuditLog({
            entity: "settings",
            entityId: "global",
            action: "RECEPTIONIST_PERMISSIONS_UPDATE",
            message: "Updated receptionist permissions",
            payload: {
              receptionistPermissions: settings.receptionistPermissions || [],
              userAgent:
                typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
            },
            createdBy: user?.uid || "",
          })
        } catch {
          // Do not block settings save if audit logging fails.
        }
      }
      toast.success("Settings saved")
    } catch {
      toast.error("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file.")
      return
    }
    setUploadingLogo(true)
    try {
      const path = getSiteLogoPath(file.name)
      const logoUrl = await uploadImage(file, path)
      setSettings((prev) => ({ ...prev, siteLogoUrl: logoUrl }))
      toast.success("Logo uploaded. Click Save Settings to apply site-wide.")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upload logo."
      toast.error(message)
    } finally {
      setUploadingLogo(false)
      e.target.value = ""
    }
  }

  function getHomeBanners(items: SiteSettings["heroBanners"]) {
    const list = Array.isArray(items) ? items : []
    const normalized = list.map((item, index) => ({
      imageUrl: String(item?.imageUrl || "").trim(),
      title: String(item?.title || `Home Banner ${index + 1}`).trim(),
      subtitle: String(item?.subtitle || "").trim(),
    }))

    return normalized.length > 0
      ? normalized
      : DEFAULT_SETTINGS.heroBanners.map((item, index) => ({
          imageUrl: String(item.imageUrl || "").trim(),
          title: String(item.title || `Home Banner ${index + 1}`).trim(),
          subtitle: String(item.subtitle || "").trim(),
        }))
  }

  async function handleBannerUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    index: number
  ) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file.")
      return
    }
    setUploadingBannerIndex(index)
    try {
      const path = getBannerImagePath(file.name)
      const imageUrl = await uploadImage(file, path)
      setSettings((prev) => {
        const nextBanners = getHomeBanners(prev.heroBanners)
        nextBanners[index] = {
          ...nextBanners[index],
          imageUrl,
        }
        return { ...prev, heroBanners: nextBanners }
      })
      toast.success(`Home image ${index + 1} uploaded. Click Save Settings.`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upload home image."
      toast.error(message)
    } finally {
      setUploadingBannerIndex(null)
      e.target.value = ""
    }
  }

  function updateHomeBanner(
    index: number,
    field: "title" | "subtitle",
    value: string
  ) {
    setSettings((prev) => {
      const nextBanners = getHomeBanners(prev.heroBanners)
      nextBanners[index] = {
        ...nextBanners[index],
        [field]: value,
      }
      return { ...prev, heroBanners: nextBanners }
    })
  }

  function addHomeBanner() {
    setSettings((prev) => {
      const nextBanners = getHomeBanners(prev.heroBanners)
      nextBanners.push({
        imageUrl: "",
        title: `Home Banner ${nextBanners.length + 1}`,
        subtitle: "",
      })
      return { ...prev, heroBanners: nextBanners }
    })
  }

  function removeHomeBanner(index: number) {
    setSettings((prev) => {
      const nextBanners = getHomeBanners(prev.heroBanners).filter((_, i) => i !== index)
      return { ...prev, heroBanners: nextBanners }
    })
  }

  const emailPreviewValues: Record<string, string> = {
    userName: "Sukumar",
    bookingId: "BK-2026-000145",
    invoiceNumber: "INV-2026-000145",
    listingName: "Main Function Hall",
    dates: "2026-03-10",
    slots: "Evening Slot",
    allocatedUnits: "Room 101, Bed 2",
    amountPaid: "5000.00",
    invoiceLink: "https://example.com/invoice/INV-2026-000145",
    supportLink: "https://example.com/support",
  }

  const placeholderKeys = Object.keys(emailPreviewValues)

  function renderTemplatePreview(template: string) {
    return Object.entries(emailPreviewValues).reduce((result, [key, value]) => {
      return result.split(`{${key}}`).join(value)
    }, template || "")
  }

  function updateSocialLink(index: number, field: keyof SocialLink, value: string) {
    setSettings((prev) => {
      const next = [...(prev.socialLinks || [])]
      next[index] = {
        platform: next[index]?.platform || "custom",
        label: next[index]?.label || "",
        url: next[index]?.url || "",
        [field]: value,
      }
      return { ...prev, socialLinks: next }
    })
  }

  function addSocialLink() {
    setSettings((prev) => ({
      ...prev,
      socialLinks: [
        ...(prev.socialLinks || []),
        { platform: "custom", label: "New Link", url: "" },
      ],
    }))
  }

  function removeSocialLink(index: number) {
    setSettings((prev) => ({
      ...prev,
      socialLinks: (prev.socialLinks || []).filter((_, i) => i !== index),
    }))
  }

  function toggleReceptionistPermission(permission: Permission) {
    setSettings((prev) => {
      const current = new Set(prev.receptionistPermissions || [])
      if (current.has(permission)) {
        current.delete(permission)
      } else {
        current.add(permission)
      }
      return { ...prev, receptionistPermissions: Array.from(current) }
    })
  }

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
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure system-wide settings for your platform
        </p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Branding</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              {settings.siteLogoUrl ? (
                <img
                  src={settings.siteLogoUrl}
                  alt="Current site logo"
                  className="h-14 w-14 rounded object-cover border"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded border text-xs text-muted-foreground">
                  No Logo
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="site-logo-upload">Website Logo</Label>
                <Input
                  id="site-logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                />
                <p className="text-xs text-muted-foreground">
                  Upload a square logo. After upload, click Save Settings.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-sm font-medium">Home Page Images</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add multiple images and descriptions for the home page.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addHomeBanner}>
                  <Plus className="mr-1 h-4 w-4" />
                  Add Image
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {getHomeBanners(settings.heroBanners).map((banner, index) => (
                  <div
                    key={`home-banner-${index}`}
                    className="flex flex-col gap-2 rounded-lg border p-3"
                  >
                    {banner.imageUrl ? (
                      <img
                        src={banner.imageUrl}
                        alt={`Home image ${index + 1}`}
                        className="h-32 w-full rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-32 w-full items-center justify-center rounded border text-xs text-muted-foreground">
                        No image uploaded
                      </div>
                    )}
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleBannerUpload(e, index)}
                      disabled={uploadingBannerIndex === index}
                    />
                    <Input
                      value={banner.title}
                      onChange={(e) =>
                        updateHomeBanner(index, "title", e.target.value)
                      }
                      placeholder="Image title"
                    />
                    <Textarea
                      rows={2}
                      value={banner.subtitle}
                      onChange={(e) =>
                        updateHomeBanner(index, "subtitle", e.target.value)
                      }
                      placeholder="Image description"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeHomeBanner(index)}
                      disabled={getHomeBanners(settings.heroBanners).length <= 1}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Remove
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      {uploadingBannerIndex === index
                        ? "Uploading..."
                        : `Home image ${index + 1}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Roles & Permissions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <Label className="text-sm font-medium">Receptionist Permissions</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Configure receptionist access. Admin always keeps full access.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {RECEPTIONIST_PERMISSION_GROUPS.map((group) => (
                <div key={group.module} className="rounded-lg border p-3">
                  <p className="mb-2 text-sm font-semibold text-foreground">{group.module}</p>
                  <div className="grid gap-2">
                    {group.permissions.map((item) => (
                      <label
                        key={item.key}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <Checkbox
                          checked={(settings.receptionistPermissions || []).includes(item.key)}
                          onCheckedChange={() =>
                            toggleReceptionistPermission(item.key)
                          }
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pricing & Fees</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label>Service Fee (%)</Label>
              <Input
                type="number"
                min={0}
                max={50}
                step={0.5}
                value={settings.serviceFeePercent}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    serviceFeePercent: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Tax (%)</Label>
              <Input
                type="number"
                min={0}
                max={50}
                step={0.5}
                value={settings.taxPercent}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    taxPercent: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Min. Advance (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={settings.minAdvancePercent}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    minAdvancePercent: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Payment Reminder System</Label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={settings.paymentRemindersEnabled !== false}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      paymentRemindersEnabled: Boolean(checked),
                    })
                  }
                />
                <span>Enable 7/3/1-day payment reminders</span>
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Contact Email</Label>
              <Input
                type="email"
                value={settings.contactEmail}
                disabled={!isAdminUser}
                onChange={(e) =>
                  setSettings({ ...settings, contactEmail: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Contact Phone</Label>
              <Input
                value={settings.contactPhone}
                disabled={!isAdminUser}
                onChange={(e) =>
                  setSettings({ ...settings, contactPhone: e.target.value })
                }
              />
            </div>
            <div className="sm:col-span-2 mt-2 border-t pt-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Social Links</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add, edit, or delete footer social links.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addSocialLink}>
                  Add Link
                </Button>
              </div>
              <div className="flex flex-col gap-3">
                {(settings.socialLinks || []).map((item, index) => (
                  <div
                    key={`${item.platform}-${index}`}
                    className="grid gap-2 rounded-lg border p-3 sm:grid-cols-12"
                  >
                    <div className="sm:col-span-3">
                      <Input
                        value={item.platform}
                        onChange={(e) =>
                          updateSocialLink(index, "platform", e.target.value)
                        }
                        placeholder="platform"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <Input
                        value={item.label}
                        onChange={(e) => updateSocialLink(index, "label", e.target.value)}
                        placeholder="label"
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <Input
                        value={item.url}
                        onChange={(e) => updateSocialLink(index, "url", e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={() => removeSocialLink(index)}
                        aria-label="Delete social link"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Booking Configuration</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Max Booking Window (days)</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={settings.maxBookingWindowDays}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxBookingWindowDays: parseInt(e.target.value) || 90,
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Refund Policy Text</Label>
              <Textarea
                rows={4}
                value={settings.refundPolicyText}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    refundPolicyText: e.target.value,
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Cancellation refund rules</Label>
              <p className="text-xs text-muted-foreground">
                First matching rule (by days before event) determines refund percent. E.g. 7 days → 100%, 3 days → 50%, 1 day → 0%. Add rules with days in descending order.
              </p>
              <div className="flex flex-col gap-2 rounded-md border p-3">
                {(settings.refundPolicyRules ?? []).map((rule, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      placeholder="Days before"
                      className="w-28"
                      value={rule.daysBefore}
                      onChange={(e) => {
                        const next = [...(settings.refundPolicyRules ?? [])]
                        next[idx] = { ...next[idx], daysBefore: parseInt(e.target.value, 10) || 0 }
                        setSettings({ ...settings, refundPolicyRules: next })
                      }}
                    />
                    <span className="text-muted-foreground">→</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="%"
                      className="w-20"
                      value={rule.percent}
                      onChange={(e) => {
                        const next = [...(settings.refundPolicyRules ?? [])]
                        next[idx] = { ...next[idx], percent: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)) }
                        setSettings({ ...settings, refundPolicyRules: next })
                      }}
                    />
                    <span className="text-muted-foreground">% refund</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const next = (settings.refundPolicyRules ?? []).filter((_, i) => i !== idx)
                        setSettings({ ...settings, refundPolicyRules: next })
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      refundPolicyRules: [...(settings.refundPolicyRules ?? []), { daysBefore: 7, percent: 100 }],
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add rule
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Check-in & Check-out (system defaults)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Default times used by the booking lifecycle. Guests can check-in only after the check-in time on the event date. Bookings are auto-checked out after the check-out time if not manually checked out. Listings can override these per listing.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Default check-in time</Label>
                <Input
                  type="time"
                  value={settings.defaultCheckInTime ?? "12:00"}
                  onChange={(e) =>
                    setSettings({ ...settings, defaultCheckInTime: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Default check-out time</Label>
                <Input
                  type="time"
                  value={settings.defaultCheckOutTime ?? "11:00"}
                  onChange={(e) =>
                    setSettings({ ...settings, defaultCheckOutTime: e.target.value })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email Templates</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Customize booking confirmation email text. Use placeholders to auto-fill
              booking data.
            </p>
            <div className="flex flex-col gap-2">
              <Label>Booking Confirmation Subject</Label>
              <Input
                value={settings.bookingEmailSubjectTemplate || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    bookingEmailSubjectTemplate: e.target.value,
                  })
                }
                placeholder="Booking Confirmed - {invoiceNumber}"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Booking Confirmation HTML</Label>
              <Textarea
                rows={8}
                value={settings.bookingEmailHtmlTemplate || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    bookingEmailHtmlTemplate: e.target.value,
                  })
                }
                className="font-mono text-xs"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Checkout Subject</Label>
              <Input
                value={settings.checkoutEmailSubjectTemplate || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    checkoutEmailSubjectTemplate: e.target.value,
                  })
                }
                placeholder="Checkout Confirmed - {bookingId}"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Checkout HTML</Label>
              <Textarea
                rows={6}
                value={settings.checkoutEmailHtmlTemplate || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    checkoutEmailHtmlTemplate: e.target.value,
                  })
                }
                className="font-mono text-xs"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {placeholderKeys.map((key) => (
                <span
                  key={key}
                  className="rounded border bg-muted px-2 py-1 text-xs text-muted-foreground"
                >
                  {`{${key}}`}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setSettings({
                    ...settings,
                    bookingEmailSubjectTemplate:
                      DEFAULT_SETTINGS.bookingEmailSubjectTemplate || "",
                    bookingEmailHtmlTemplate:
                      DEFAULT_SETTINGS.bookingEmailHtmlTemplate || "",
                    checkoutEmailSubjectTemplate:
                      DEFAULT_SETTINGS.checkoutEmailSubjectTemplate || "",
                    checkoutEmailHtmlTemplate:
                      DEFAULT_SETTINGS.checkoutEmailHtmlTemplate || "",
                  })
                }
              >
                Reset Template to Default
              </Button>
            </div>
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-xs font-medium text-foreground">Preview Subject</p>
              <p className="mb-3 text-sm text-muted-foreground">
                {renderTemplatePreview(settings.bookingEmailSubjectTemplate || "")}
              </p>
              <p className="mb-2 text-xs font-medium text-foreground">Preview Body</p>
              <div
                className="prose prose-sm max-w-none text-foreground"
                dangerouslySetInnerHTML={{
                  __html: renderTemplatePreview(settings.bookingEmailHtmlTemplate || ""),
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Razorpay Configuration</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Razorpay Key ID</Label>
              <Input
                value={settings.razorpayKeyId}
                onChange={(e) =>
                  setSettings({ ...settings, razorpayKeyId: e.target.value })
                }
                placeholder="rzp_test_xxxxx / rzp_live_xxxxx"
              />
              <p className="text-xs text-muted-foreground">
                Public key used by checkout. Keep secret key on backend only.
              </p>
            </div>
            {isAdminUser && (
              <div className="flex flex-col gap-2">
                <Label>Razorpay Secret Key</Label>
                <Input
                  type="password"
                  value={secureSettings.razorpaySecretKey}
                  onChange={(e) =>
                    setSecureSettings({
                      ...secureSettings,
                      razorpaySecretKey: e.target.value,
                    })
                  }
                  placeholder="rzp_live_xxxxxxxxx_secret"
                />
                <p className="text-xs text-muted-foreground">
                  Stored for admin reference only. Do not use in frontend code.
                </p>
              </div>
            )}
            {isAdminUser && (
              <div className="flex flex-col gap-2">
                <Label>Razorpay Webhook Secret</Label>
                <Input
                  type="password"
                  value={secureSettings.razorpayWebhookSecret || ""}
                  onChange={(e) =>
                    setSecureSettings({
                      ...secureSettings,
                      razorpayWebhookSecret: e.target.value,
                    })
                  }
                  placeholder="whsec_xxxxx"
                />
                <p className="text-xs text-muted-foreground">
                  From Razorpay Dashboard → Settings → Webhooks. Used to verify payment.captured / payment.failed so booking status updates on mobile.
                </p>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label>Display Name</Label>
              <Input
                value={settings.razorpayDisplayName}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    razorpayDisplayName: e.target.value,
                  })
                }
                placeholder="Anga Function Hall"
              />
            </div>
          </CardContent>
        </Card>

        {isAdminUser && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">SMTP Configuration</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>SMTP Host</Label>
                <Input
                  value={secureSettings.smtpHost}
                  onChange={(e) =>
                    setSecureSettings({ ...secureSettings, smtpHost: e.target.value })
                  }
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>SMTP Port</Label>
                <Input
                  type="number"
                  value={secureSettings.smtpPort}
                  onChange={(e) =>
                    setSecureSettings({
                      ...secureSettings,
                      smtpPort: Number(e.target.value) || 587,
                    })
                  }
                  placeholder="587"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>SMTP Secure</Label>
                <Input
                  value={String(secureSettings.smtpSecure)}
                  onChange={(e) =>
                    setSecureSettings({
                      ...secureSettings,
                      smtpSecure: e.target.value.toLowerCase() === "true",
                    })
                  }
                  placeholder="true / false"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>SMTP User</Label>
                <Input
                  value={secureSettings.smtpUser}
                  onChange={(e) =>
                    setSecureSettings({ ...secureSettings, smtpUser: e.target.value })
                  }
                  placeholder="username"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>SMTP Password</Label>
                <Input
                  type="password"
                  value={secureSettings.smtpPass}
                  onChange={(e) =>
                    setSecureSettings({ ...secureSettings, smtpPass: e.target.value })
                  }
                  placeholder="app password"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>SMTP From Name</Label>
                <Input
                  value={secureSettings.smtpFromName}
                  onChange={(e) =>
                    setSecureSettings({ ...secureSettings, smtpFromName: e.target.value })
                  }
                  placeholder="Anga Function Hall"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>SMTP From Email</Label>
                <Input
                  value={secureSettings.smtpFromEmail}
                  onChange={(e) =>
                    setSecureSettings({ ...secureSettings, smtpFromEmail: e.target.value })
                  }
                  placeholder="noreply@example.com"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Admin Notification Email (Optional)</Label>
                <Input
                  value={secureSettings.adminNotificationEmail}
                  onChange={(e) =>
                    setSecureSettings({
                      ...secureSettings,
                      adminNotificationEmail: e.target.value,
                    })
                  }
                  placeholder="admin@example.com"
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label>App Base URL</Label>
                <Input
                  value={secureSettings.appBaseUrl}
                  onChange={(e) =>
                    setSecureSettings({ ...secureSettings, appBaseUrl: e.target.value })
                  }
                  placeholder="https://your-domain.com"
                />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </form>
    </div>
  )
}
