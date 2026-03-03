import { LoginForm } from "@/components/auth/login-form"
import { Building2 } from "lucide-react"
import Link from "next/link"

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 bg-primary lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Link href="/" className="flex items-center gap-2">
          <Building2 className="h-8 w-8 text-primary-foreground" />
          <span className="text-xl font-bold text-primary-foreground">
            VenueBook
          </span>
        </Link>
        <div className="flex flex-col gap-4">
          <h2 className="text-3xl font-bold text-primary-foreground text-balance">
            Book premium venues and services for your events
          </h2>
          <p className="text-primary-foreground/80 text-pretty">
            Function halls, rooms, dormitories, dining and more - all in one
            place with instant availability and secure payments.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/60">
          Trusted by thousands of guests across India
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="flex items-center justify-center gap-2">
              <Building2 className="h-7 w-7 text-primary" />
              <span className="text-lg font-bold text-foreground">VenueBook</span>
            </Link>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
