"use client"

import { useEffect, useState } from "react"
import {
  getSecureSettings,
  getSettings,
  updateSecureSettings,
  updateSettings,
} from "@/lib/firebase-db"
import type { SecureSettings, SiteSettings } from "@/lib/types"
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

export default function SettingsPage() {
  const { isAdminUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingBannerIndex, setUploadingBannerIndex] = useState<number | null>(null)
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS)
  const [secureSettings, setSecureSettings] = useState<SecureSettings>({
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
    setSaving(true)
    try {
      await updateSettings(settings)
      if (isAdminUser) {
        await updateSecureSettings(secureSettings)
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

  function getHomeBannerUrls(items: SiteSettings["heroBanners"]) {
    const fallback = DEFAULT_SETTINGS.heroBanners
    const normalized = [...fallback].map((item, index) => {
      const current = items?.[index]
      return {
        ...item,
        imageUrl: current?.imageUrl || item.imageUrl,
      }
    })
    return normalized
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
        const nextBanners = getHomeBannerUrls(prev.heroBanners)
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
              <div>
                <Label className="text-sm font-medium">Home Page Images</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload 3 images shown on the Home page.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {getHomeBannerUrls(settings.heroBanners).map((banner, index) => (
                  <div
                    key={`home-banner-${index}`}
                    className="flex flex-col gap-2 rounded-lg border p-3"
                  >
                    <img
                      src={banner.imageUrl}
                      alt={`Home image ${index + 1}`}
                      className="h-32 w-full rounded object-cover"
                    />
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleBannerUpload(e, index)}
                      disabled={uploadingBannerIndex === index}
                    />
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
                onChange={(e) =>
                  setSettings({ ...settings, contactEmail: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Contact Phone</Label>
              <Input
                value={settings.contactPhone}
                onChange={(e) =>
                  setSettings({ ...settings, contactPhone: e.target.value })
                }
              />
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
