import { createHmac, timingSafeEqual } from "crypto"

/**
 * Verify Razorpay webhook signature. Must use the raw request body (string or Buffer), not parsed JSON.
 * @see https://razorpay.com/docs/webhooks/validate-test/
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string | Buffer,
  signature: string,
  webhookSecret: string
): boolean {
  if (!signature || !webhookSecret) return false
  const body = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8")
  const expected = createHmac("sha256", webhookSecret).update(body).digest("hex")
  const expectedBuf = Buffer.from(expected, "utf8")
  const receivedBuf = Buffer.from(signature, "utf8")
  return expectedBuf.length === receivedBuf.length && timingSafeEqual(expectedBuf, receivedBuf)
}
