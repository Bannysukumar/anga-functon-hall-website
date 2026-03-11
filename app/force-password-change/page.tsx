"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { updatePassword } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { getUser } from "@/lib/firebase-db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export default function ForcePasswordChangePage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (password.length < 10) {
      toast.error("Password must be at least 10 characters.")
      return
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.")
      return
    }
    const currentUser = auth.currentUser
    if (!currentUser) {
      toast.error("Please login again.")
      router.push("/login")
      return
    }

    setSaving(true)
    try {
      await updatePassword(currentUser, password)
      const idToken = await currentUser.getIdToken(true)
      await fetch("/api/auth/force-password-change", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      })
      const appUser = await getUser(currentUser.uid)
      toast.success("Password updated successfully.")
      if (String(appUser?.role || "user") === "admin") {
        router.replace("/admin-dashboard")
      } else {
        router.replace("/dashboard")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update password.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              For security reasons, please update your temporary password before continuing.
            </p>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimum 10 characters"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter password"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
