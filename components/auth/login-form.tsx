"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { logIn, logInWithGoogle } from "@/lib/firebase-auth"
import { getUser } from "@/lib/firebase-db"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import Link from "next/link"

const LOGIN_RATE_LIMIT_KEY = "login_rate_limit"
const LOGIN_MAX_ATTEMPTS = 5
const LOGIN_WINDOW_MS = 10 * 60 * 1000

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function resolvePostLoginRoute(uid: string) {
    const appUser = await getUser(uid)
    if (Boolean(appUser?.forcePasswordChange)) return "/force-password-change"
    const role = String(appUser?.role || "user")
    if (role === "admin") return "/admin-dashboard"
    return "/dashboard"
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const now = Date.now()
    const stored =
      typeof window !== "undefined" ? window.localStorage.getItem(LOGIN_RATE_LIMIT_KEY) : null
    const parsed = stored ? JSON.parse(stored) as { count: number; firstAt: number } : null
    if (parsed && now - parsed.firstAt < LOGIN_WINDOW_MS && parsed.count >= LOGIN_MAX_ATTEMPTS) {
      toast.error("Too many login attempts. Please try again in a few minutes.")
      return
    }
    setLoading(true)
    try {
      const user = await logIn(email, password)
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(LOGIN_RATE_LIMIT_KEY)
      }
      const nextRoute = await resolvePostLoginRoute(user.uid)
      toast.success("Welcome back!")
      router.push(nextRoute)
    } catch (error: unknown) {
      if (typeof window !== "undefined") {
        const current =
          now - (parsed?.firstAt || now) > LOGIN_WINDOW_MS
            ? { count: 1, firstAt: now }
            : { count: (parsed?.count || 0) + 1, firstAt: parsed?.firstAt || now }
        window.localStorage.setItem(LOGIN_RATE_LIMIT_KEY, JSON.stringify(current))
      }
      const message =
        error instanceof Error ? error.message : "Login failed. Please try again."
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setLoading(true)
    try {
      const user = await logInWithGoogle()
      const nextRoute = await resolvePostLoginRoute(user.uid)
      toast.success("Welcome!")
      router.push(nextRoute)
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Google login failed."
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in to your account to continue
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
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={handleGoogle}
        disabled={loading}
        className="w-full"
      >
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Google
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {"Don't have an account? "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  )
}
