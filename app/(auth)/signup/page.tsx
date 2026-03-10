import { SignupForm } from "@/components/auth/signup-form"
import { SiteLogo } from "@/components/layout/site-logo"
import Link from "next/link"
import { Suspense } from "react"

export default function SignupPage() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 bg-primary lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Link href="/" className="flex items-center gap-2">
          <SiteLogo
            iconClassName="h-8 w-8 text-primary-foreground"
            textClassName="text-xl font-bold text-primary-foreground"
          />
        </Link>
        <div className="flex flex-col gap-4">
          <h2 className="text-3xl font-bold text-primary-foreground text-balance">
            Start booking your perfect venue today
          </h2>
          <p className="text-primary-foreground/80 text-pretty">
            Create an account to access exclusive deals, track your bookings,
            and manage everything in one place.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/60">
          Join thousands of happy customers
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="flex items-center justify-center gap-2">
              <SiteLogo />
            </Link>
          </div>
          <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
            <SignupForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
