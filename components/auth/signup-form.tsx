"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useSearchParams } from "next/navigation"
import { signUp } from "@/lib/firebase-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"

function normalizeMobile(value: string): string {
  return String(value || "").replace(/\D/g, "")
}

function isValidIndianMobile(value: string): boolean {
  return /^[6-9]\d{9}$/.test(value)
}

export function SignupForm() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [mobileNumber, setMobileNumber] = useState("")
  const [referralCode, setReferralCode] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isCheckingReferral, setIsCheckingReferral] = useState(false)
  const [isReferralValid, setIsReferralValid] = useState(false)
  const [referralMessage, setReferralMessage] = useState("")
  const [isMobileTaken, setIsMobileTaken] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialReferralCode = (
    searchParams.get("ref") ||
    (typeof window !== "undefined" ? localStorage.getItem("pending_ref_code") : "") ||
    ""
  )
    .trim()
    .toUpperCase()

  useEffect(() => {
    setReferralCode(initialReferralCode)
  }, [initialReferralCode])

  useEffect(() => {
    if (typeof window !== "undefined" && referralCode.trim()) {
      localStorage.setItem("pending_ref_code", referralCode.trim().toUpperCase())
    }
  }, [referralCode])

  const deviceId = useMemo(() => {
    if (typeof window === "undefined") return ""
    const existing = localStorage.getItem("anga_device_id")
    if (existing) return existing
    const next = `dev_${Math.random().toString(36).slice(2)}_${Date.now()}`
    localStorage.setItem("anga_device_id", next)
    return next
  }, [])

  useEffect(() => {
    const normalizedMobile = normalizeMobile(mobileNumber)
    const normalizedReferralCode = referralCode.trim().toUpperCase()

    if (!normalizedMobile || !normalizedReferralCode) {
      setIsCheckingReferral(false)
      setIsReferralValid(false)
      setReferralMessage("")
      setIsMobileTaken(false)
      return
    }
    if (!isValidIndianMobile(normalizedMobile)) {
      setIsCheckingReferral(false)
      setIsReferralValid(false)
      setReferralMessage("Enter a valid 10-digit Indian mobile number")
      setIsMobileTaken(false)
      return
    }

    setIsCheckingReferral(true)
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/auth/validate-signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mobileNumber: normalizedMobile,
            referralCode: normalizedReferralCode,
          }),
        })
        const payload = (await response.json()) as {
          mobileValid?: boolean
          mobileExists?: boolean
          referralValid?: boolean
          referrerName?: string
          error?: string
        }
        if (!response.ok) {
          throw new Error(payload.error || "Validation failed")
        }
        const mobileExists = Boolean(payload.mobileExists)
        const referralValid = Boolean(payload.referralValid)
        setIsMobileTaken(mobileExists)
        setIsReferralValid(referralValid && !mobileExists)
        if (mobileExists) {
          setReferralMessage("This mobile number is already registered.")
        } else if (referralValid) {
          setReferralMessage(`Referred by: ${String(payload.referrerName || "User")}`)
        } else {
          setReferralMessage("Invalid referral code")
        }
      } catch (error) {
        setIsReferralValid(false)
        setReferralMessage(error instanceof Error ? error.message : "Validation failed")
      } finally {
        setIsCheckingReferral(false)
      }
    }, 450)

    return () => {
      window.clearTimeout(timer)
    }
  }, [mobileNumber, referralCode])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const normalizedMobile = normalizeMobile(mobileNumber)
    const normalizedReferralCode = referralCode.trim().toUpperCase()

    if (!isValidIndianMobile(normalizedMobile)) {
      toast.error("Enter a valid 10-digit Indian mobile number")
      return
    }
    if (!normalizedReferralCode) {
      toast.error("Referral code is required")
      return
    }
    if (isMobileTaken) {
      toast.error("This mobile number is already registered.")
      return
    }
    if (!isReferralValid) {
      toast.error("Invalid referral code")
      return
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }
    setLoading(true)
    try {
      await signUp(
        email,
        password,
        name,
        normalizedMobile,
        normalizedReferralCode,
        deviceId || undefined
      )
      if (typeof window !== "undefined") {
        localStorage.removeItem("pending_ref_code")
      }
      toast.success("Account created! Welcome aboard.")
      router.push("/dashboard")
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Signup failed. Please try again."
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const normalizedMobile = normalizeMobile(mobileNumber)
  const canSubmit =
    !loading &&
    !isCheckingReferral &&
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 8 &&
    confirmPassword.length >= 8 &&
    password === confirmPassword &&
    isValidIndianMobile(normalizedMobile) &&
    referralCode.trim().length > 0 &&
    isReferralValid &&
    !isMobileTaken

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Create an account
        </h1>
        <p className="text-sm text-muted-foreground">
          Get started with your booking account
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            type="text"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
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
        <div className="flex flex-col gap-2">
          <Label htmlFor="mobileNumber">Mobile Number</Label>
          <Input
            id="mobileNumber"
            type="tel"
            placeholder="9876543210"
            value={mobileNumber}
            onChange={(e) => {
              const digits = normalizeMobile(e.target.value).slice(0, 10)
              setMobileNumber(digits)
            }}
            inputMode="numeric"
            pattern="[0-9]{10}"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="pr-10"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 right-2 inline-flex items-center text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="pr-10"
            />
            <button
              type="button"
              aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              onClick={() => setShowConfirmPassword((value) => !value)}
              className="absolute inset-y-0 right-2 inline-flex items-center text-muted-foreground hover:text-foreground"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {confirmPassword.length > 0 && password !== confirmPassword ? (
            <p className="text-xs text-red-600">Passwords do not match</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="referralCode">Referral Code</Label>
          <Input
            id="referralCode"
            type="text"
            placeholder="Enter referral code"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
            required
          />
          {isCheckingReferral ? (
            <p className="text-xs text-muted-foreground">Validating referral code...</p>
          ) : referralMessage ? (
            <p className={`text-xs ${isReferralValid ? "text-emerald-600" : "text-red-600"}`}>
              {referralMessage}
            </p>
          ) : null}
        </div>

        <Button type="submit" disabled={!canSubmit} className="w-full">
          {loading ? "Creating account..." : "Create Account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
