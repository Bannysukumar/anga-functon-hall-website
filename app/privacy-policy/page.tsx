import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"

export const metadata: Metadata = {
  title: "Privacy Policy | VenueBook",
  description:
    "Read how VenueBook collects, uses, stores, and protects your personal data.",
}

export default function PrivacyPolicyPage() {
  const updatedOn = "March 3, 2026"

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-secondary/20">
        <div className="mx-auto max-w-4xl px-4 py-10 lg:px-8">
          <article className="rounded-xl border bg-background p-6 shadow-sm md:p-8">
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">
              Privacy Policy
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Last updated: {updatedOn}
            </p>

            <div className="mt-6 space-y-6 text-sm leading-7 text-muted-foreground">
              <section>
                <h2 className="text-base font-semibold text-foreground">
                  1. Information We Collect
                </h2>
                <p>
                  We collect information you provide directly, including your
                  name, email address, phone number, booking details, and
                  payment-related identifiers. We also collect technical data
                  such as device and usage information for security and service
                  improvement.
                </p>
              </section>

              <section>
                <h2 className="text-base font-semibold text-foreground">
                  2. How We Use Your Information
                </h2>
                <p>
                  We use your information to create and manage accounts,
                  process bookings, send booking updates, support customer
                  requests, prevent fraud, comply with legal obligations, and
                  improve platform reliability.
                </p>
              </section>

              <section>
                <h2 className="text-base font-semibold text-foreground">
                  3. Payments and Security
                </h2>
                <p>
                  Payments are processed through Razorpay. We do not store card
                  numbers on our servers. Payment verification is performed on
                  secure server endpoints before confirming bookings.
                </p>
              </section>

              <section>
                <h2 className="text-base font-semibold text-foreground">
                  4. Data Sharing
                </h2>
                <p>
                  We share data only with service providers required to operate
                  the platform (for example, Firebase for backend services and
                  Razorpay for payment processing), or when legally required.
                  We do not sell personal data.
                </p>
              </section>

              <section>
                <h2 className="text-base font-semibold text-foreground">
                  5. Data Retention
                </h2>
                <p>
                  We retain personal data for as long as needed to provide
                  services, resolve disputes, enforce agreements, and comply
                  with applicable law.
                </p>
              </section>

              <section>
                <h2 className="text-base font-semibold text-foreground">
                  6. Your Rights
                </h2>
                <p>
                  You can request access, correction, or deletion of your
                  personal information by contacting us. Some data may be
                  retained if required for legal or security purposes.
                </p>
              </section>

              <section>
                <h2 className="text-base font-semibold text-foreground">
                  7. Account and Access Controls
                </h2>
                <p>
                  Access to booking and account data is protected by Firebase
                  authentication and security rules. Users can access only their
                  own data, and admin access is role-restricted.
                </p>
              </section>

              <section>
                <h2 className="text-base font-semibold text-foreground">
                  8. Updates to This Policy
                </h2>
                <p>
                  We may update this Privacy Policy from time to time. Material
                  changes will be reflected by updating the "Last updated" date
                  on this page.
                </p>
              </section>

              <section>
                <h2 className="text-base font-semibold text-foreground">
                  9. Contact
                </h2>
                <p>
                  For privacy concerns, contact us at{" "}
                  <a
                    href="mailto:contact@venuebook.in"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    contact@venuebook.in
                  </a>
                  .
                </p>
              </section>
            </div>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  )
}
