import { httpsCallable } from "firebase/functions"
import { functions } from "@/lib/firebase"

export type VerifyAndConfirmPayload = {
  intentId: string
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}

export type VerifyAndConfirmResponse = {
  ok: boolean
  bookingId: string
  invoiceId: string
  invoiceNumber: string
  invoicePdfUrl?: string
  allocatedLabels: string[]
  emailStatus: "pending" | "sent" | "failed"
  idempotent?: boolean
}

export async function verifyPaymentAndConfirmBooking(
  payload: VerifyAndConfirmPayload
) {
  const callable = httpsCallable<
    VerifyAndConfirmPayload,
    VerifyAndConfirmResponse
  >(functions, "verifyPaymentAndConfirmBooking")
  const result = await callable(payload)
  return result.data
}

export async function resendBookingConfirmationEmail(
  bookingId: string,
  forceResend = false
) {
  const callable = httpsCallable<
    { bookingId: string; forceResend: boolean },
    { ok: boolean; emailStatus: string; skipped?: boolean }
  >(
    functions,
    "resendBookingConfirmationEmail"
  )
  const result = await callable({ bookingId, forceResend })
  return result.data
}

export async function getInvoiceDownloadUrl(invoiceId: string) {
  const callable = httpsCallable<{ invoiceId: string }, { ok: boolean; url: string }>(
    functions,
    "getInvoiceDownloadUrl"
  )
  const result = await callable({ invoiceId })
  return result.data
}

export async function adminCheckIn(bookingId: string) {
  const callable = httpsCallable<{ bookingId: string }, { ok: boolean; bookingId: string }>(
    functions,
    "adminCheckIn"
  )
  const result = await callable({ bookingId })
  return result.data
}

export async function adminCheckOut(bookingId: string, note = "") {
  const callable = httpsCallable<
    { bookingId: string; note: string },
    { ok: boolean; bookingId: string; status: string; idempotent?: boolean }
  >(functions, "adminCheckOut")
  const result = await callable({ bookingId, note })
  return result.data
}

export async function userCheckOut(bookingId: string) {
  const callable = httpsCallable<
    { bookingId: string },
    { ok: boolean; bookingId: string; status: string; idempotent?: boolean }
  >(functions, "userCheckOut")
  const result = await callable({ bookingId })
  return result.data
}

export async function resendCheckoutEmail(bookingId: string) {
  const callable = httpsCallable<
    { bookingId: string },
    { ok: boolean; checkoutEmailStatus: string }
  >(functions, "resendCheckoutEmail")
  const result = await callable({ bookingId })
  return result.data
}
