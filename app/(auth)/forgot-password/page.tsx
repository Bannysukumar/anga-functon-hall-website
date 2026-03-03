"use client"

import { useState } from "react"
import { resetPassword } from "@/lib/firebase-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Building2, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await resetPassword(email)
      setSent(true)
      toast.success("Password reset email sent!")
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to send reset email."
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <Link href="/" className="flex items-center justify-center gap-2">
          <Building2 className="h-7 w-7 text-primary" />
          <span className="text-lg font-bold text-foreground">Anga Function Hall</span>
        </Link>

        {sent ? (
          <div className="flex flex-col gap-4 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Check your email
            </h1>
            <p className="text-sm text-muted-foreground">
              We sent a password reset link to <strong>{email}</strong>. Click
              the link in the email to reset your password.
            </p>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to login
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Reset your password
              </h1>
              <p className="text-sm text-muted-foreground">
                {"Enter your email and we'll send you a reset link"}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
            <Link
              href="/login"
              className="text-center text-sm text-primary hover:underline"
            >
              <ArrowLeft className="mr-1 inline h-3 w-3" />
              Back to login
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
