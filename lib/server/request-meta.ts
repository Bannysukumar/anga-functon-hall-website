export function getRequestMeta(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for") || ""
  const ip = forwardedFor.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown"
  const userAgent = request.headers.get("user-agent") || "unknown"
  return { ip, userAgent }
}

export function sanitizeText(value: unknown, maxLength = 500) {
  const asText = String(value ?? "").trim()
  return asText.replace(/[<>]/g, "").slice(0, maxLength)
}
