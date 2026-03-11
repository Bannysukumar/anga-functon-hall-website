"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ConfirmationResult, RecaptchaVerifier } from "firebase/auth"
import { ArrowLeft, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SiteLogo } from "@/components/layout/site-logo"
import { sendPhoneOtp, createPhoneRecaptcha, verifyPhoneOtp } from "@/lib/firebase-auth"
import { getUser } from "@/lib/firebase-db"
import { toast } from "sonner"

export default function LoginPhonePage() {
  const router = useRouter()
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null)
  const confirmationRef = useRef<ConfirmationResult | null>(null)

  const [phoneNumber, setPhoneNumber] = useState("")
  const [otp, setOtp] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [recaptchaMode, setRecaptchaMode] = useState<"invisible" | "normal">("normal")
  const [captchaStatus, setCaptchaStatus] = useState<"idle" | "ready" | "expired" | "error">("idle")
  const [captchaRendered, setCaptchaRendered] = useState(false)

  useEffect(() => {
    return () => {
      recaptchaRef.current?.clear()
      recaptchaRef.current = null
    }
  }, [])

  const clearRecaptcha = () => {
    recaptchaRef.current?.clear()
    recaptchaRef.current = null
    const container = document.getElementById("recaptcha-container")
    if (container) {
      container.innerHTML = ""
    }
    setCaptchaRendered(false)
    setCaptchaStatus("idle")
  }

  const ensureRecaptcha = async (mode: "invisible" | "normal") => {
    clearRecaptcha()
    recaptchaRef.current = createPhoneRecaptcha("recaptcha-container", mode, {
      callback: () => setCaptchaStatus("ready"),
      expiredCallback: () => {
        setCaptchaStatus("expired")
        toast.error("reCAPTCHA expired. Please complete it again.")
      },
      errorCallback: () => {
        setCaptchaStatus("error")
        toast.error("reCAPTCHA failed to load. Please retry.")
      },
    })
    await recaptchaRef.current.render()
    setCaptchaRendered(true)
    return recaptchaRef.current
  }

  useEffect(() => {
    if (otpSent) return
    void ensureRecaptcha(recaptchaMode).catch(() => {
      setCaptchaStatus("error")
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpSent, recaptchaMode])

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    if (recaptchaMode === "normal" && captchaStatus !== "ready") {
      toast.error("Please complete the captcha before sending OTP.")
      return
    }
    setSendingOtp(true)
    try {
      const verifier = recaptchaRef.current || (await ensureRecaptcha(recaptchaMode))
      const confirmation = await sendPhoneOtp(phoneNumber, verifier)
      confirmationRef.current = confirmation
      setOtpSent(true)
      toast.success("OTP sent successfully")
    } catch (error) {
      const code = (error as { code?: string } | null)?.code
      if (code === "auth/invalid-phone-number") {
        toast.error("Invalid phone number format.")
      } else if (code === "auth/invalid-app-credential" || code === "auth/captcha-check-failed") {
        setRecaptchaMode("normal")
        clearRecaptcha()
        toast.error(
          "reCAPTCHA verification failed. Please retry and complete the captcha challenge. If issue continues, open in Incognito and disable browser extensions for this page."
        )
      } else if (code === "auth/timeout" || String(error).toLowerCase().includes("recaptcha timeout")) {
        clearRecaptcha()
        toast.error("reCAPTCHA timed out. Please complete it again and retry.")
      } else if (code === "auth/too-many-requests") {
        toast.error("Too many attempts. Please try again later.")
      } else {
        toast.error(error instanceof Error ? error.message : "Failed to send OTP")
      }
    } finally {
      setSendingOtp(false)
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!confirmationRef.current) {
      toast.error("Please request OTP first.")
      return
    }
    setVerifyingOtp(true)
    try {
      const user = await verifyPhoneOtp(confirmationRef.current, otp)
      const appUser = await getUser(user.uid)
      const role = String(appUser?.role || "user")
      toast.success("Phone login successful")
      router.push(role === "admin" ? "/admin-dashboard" : "/dashboard")
    } catch (error) {
      const code = (error as { code?: string } | null)?.code
      if (code === "auth/invalid-verification-code") {
        toast.error("Incorrect verification code.")
      } else if (code === "auth/code-expired") {
        toast.error("OTP expired. Please request a new code.")
      } else {
        toast.error(error instanceof Error ? error.message : "OTP verification failed")
      }
    } finally {
      setVerifyingOtp(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md flex flex-col gap-6">
        <Link href="/" className="flex items-center justify-center gap-2">
          <SiteLogo />
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Smartphone className="h-5 w-5" />
              Continue with Phone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="phone">Enter your phone number</Label>
                  <div className="flex items-center gap-2">
                    <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
                      +91
                    </div>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="9876543210"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    required
                      className="flex-1"
                  />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter your 10-digit mobile number.
                  </p>
                </div>
                <div id="recaptcha-container" className="min-h-10" />
                {!captchaRendered ? (
                  <p className="text-xs text-muted-foreground">Loading captcha...</p>
                ) : null}
                {recaptchaMode === "normal" ? (
                  <p className="text-xs text-muted-foreground">
                    Complete reCAPTCHA before sending OTP.
                  </p>
                ) : null}
                {captchaStatus === "expired" || captchaStatus === "error" ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => void ensureRecaptcha("normal")}
                  >
                    Reset Captcha
                  </Button>
                ) : null}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={sendingOtp || (recaptchaMode === "normal" && captchaStatus !== "ready")}
                >
                  {sendingOtp ? "Sending OTP..." : "Send OTP"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="otp">Enter OTP</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={verifyingOtp}>
                  {verifyingOtp ? "Verifying OTP..." : "Verify OTP"}
                </Button>
              </form>
            )}
            <Link href="/login" className="inline-flex items-center text-sm text-primary hover:underline">
              <ArrowLeft className="mr-1 h-3 w-3" />
              Back to login
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
