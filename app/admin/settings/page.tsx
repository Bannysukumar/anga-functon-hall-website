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
import { getSiteLogoPath, uploadImage } from "@/lib/firebase-storage"
import { toast } from "sonner"
import { useAuth } from "@/lib/hooks/use-auth"

export default function SettingsPage() {
  const { isAdminUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS)
  const [secureSettings, setSecureSettings] = useState<SecureSettings>({
    razorpaySecretKey: "",
  })

  useEffect(() => {
    async function load() {
      try {
        const [data, secureData] = await Promise.all([
          getSettings(),
          isAdminUser ? getSecureSettings() : Promise.resolve({ razorpaySecretKey: "" }),
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
          <CardContent className="flex flex-col gap-4">
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

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </form>
    </div>
  )
}
