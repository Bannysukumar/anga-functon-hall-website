import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"

export const metadata: Metadata = {
  title: "Terms and Conditions | Anga Function Hall",
  description:
    "Read the terms and conditions for using Anga Function Hall and booking services.",
}

export default function TermsAndConditionsPage() {
  const updatedOn = "March 3, 2026"

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-secondary/20">
        <div className="mx-auto max-w-4xl px-4 py-10 lg:px-8">
          <article className="rounded-xl border bg-background p-6 shadow-sm md:p-8">
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">
              Terms and Conditions
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Last updated: {updatedOn}
            </p>

            <div className="mt-6 space-y-6 text-sm leading-7 text-muted-foreground">
              <section>
                <h2 className="text-base font-semibold text-foreground">
                  1. Acceptance of Terms
                </h2>
                <p>
                  By accessing or using Anga Function Hall, you agree to these Terms and
                  Conditions. If you do not agree, please do not use the
                  platform.
                </p>
              </section>

              <section>
                <h2 className="text-base font-semibold text-foreground">
                  2. Eligibility and Accounts
                </h2>
                <p>
                  You must provide accurate account information and keep your
                  login credentials secure. You are responsible for all actions
                  performed through your account.
                </p>
              </section>

              <section>
                <h2 className="text-base font-semibold text-foreground">
                  3. Booking and Availability
                </h2>
                <p>
                  Bookings are subject to availability at the time of
                  confirmation. Availability checks and inventory locks are
                  applied during booking finalization to prevent overbooking.
                </p>
              </section>

              <section>
                <h2 className="text-base font-semibold text-foreground">
                  4. Pricing and Payments
                </h2>
                <p>
                  Prices, taxes, and service fees are calculated at checkout.
                  Payments are processed via Razorpay and bookings are confirmed
                  only after successful payment verification.
                </p>
              </section>

              <section>
                <h2 className="text-base font-semibold text-foreground">
                  5. Cancellations and Refunds
                </h2>
                <p>
                  Cancellation and refund outcomes depend on listing policy and
                  payment state. Approved refunds are processed as per admin
                  workflow and payment provider timelines.
                </p>
              </section>

              <section>
                <h2 className="text-base font-semibold text-foreground">
                  6. User Conduct
                </h2>
                <p>
                  You must not misuse the platform, attempt unauthorized access,
                  disrupt services, submit fraudulent bookings, or violate
                  applicable law.
                </p>
              </section>

              <section>
                <h2 className="text-base font-semibold text-foreground">
                  7. Admin Rights and Enforcement
                </h2>
                <p>
                  Anga Function Hall may suspend or block accounts that violate terms,
                  pose security risks, or engage in abuse or fraud.
                </p>
              </section>

              <section>
                <h2 className="text-base font-semibold text-foreground">
                  8. Limitation of Liability
                </h2>
                <p>
                  To the extent permitted by law, Anga Function Hall is not liable for
                  indirect or consequential losses arising from platform use,
                  third-party provider downtime, or force majeure events.
                </p>
              </section>

              <section>
                <h2 className="text-base font-semibold text-foreground">
                  9. Changes to Terms
                </h2>
                <p>
                  We may update these Terms and Conditions periodically.
                  Continued use of the platform after updates indicates your
                  acceptance of the revised terms.
                </p>
              </section>

              <section>
                <h2 className="text-base font-semibold text-foreground">
                  10. Contact
                </h2>
                <p>
                  For legal or policy questions, contact{" "}
                  <a
                    href="mailto:angafunctonhall@gmail.com"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    angafunctonhall@gmail.com
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
