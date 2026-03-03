"use client"

import { useAuth } from "@/lib/hooks/use-auth"
import { updateUser } from "@/lib/firebase-db"
import { updateProfile } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Loader2, Save, User } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function ProfilePage() {
  const { user, appUser, refreshUser } = useAuth()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [displayName, setDisplayName] = useState(
    appUser?.displayName || user?.displayName || ""
  )
  const [phone, setPhone] = useState(appUser?.phone || "")

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      await updateProfile(auth.currentUser!, {
        displayName,
      })
      await updateUser(user.uid, {
        displayName,
        phone,
      })
      await refreshUser()
      toast({ title: "Profile updated successfully" })
    } catch {
      toast({
        title: "Error",
        description: "Failed to update profile.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const initials =
    (displayName || user?.email || "U")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account information
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-base font-semibold text-foreground">
                {displayName || "User"}
              </p>
              <p className="text-sm font-normal text-muted-foreground">
                {user?.email}
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Separator />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="displayName">Full Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your full name"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user?.email || ""}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Account ID</p>
              <p className="font-mono text-xs text-foreground">{user?.uid}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Member Since</p>
              <p className="text-foreground">
                {user?.metadata?.creationTime
                  ? new Date(user.metadata.creationTime).toLocaleDateString(
                      "en-IN",
                      { day: "numeric", month: "long", year: "numeric" }
                    )
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Email Verified</p>
              <p className="text-foreground">
                {user?.emailVerified ? "Yes" : "No"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
