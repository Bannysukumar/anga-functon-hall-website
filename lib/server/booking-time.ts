export function bookingDateKeyFromInput(input: string) {
  const trimmed = String(input || "").trim()
  const direct = trimmed.match(/^(\d{4}-\d{2}-\d{2})/)
  if (direct?.[1]) return direct[1]
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return ""
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, "0")
  const day = String(parsed.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function bookingDateKeyFromDate(date: Date | null | undefined) {
  if (!date) return ""
  if (Number.isNaN(date.getTime())) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function toMinutes(hhmm: string) {
  const [h, m] = String(hhmm || "")
    .split(":")
    .map((value) => Number(value))
  if (!Number.isFinite(h) || !Number.isFinite(m)) return -1
  return h * 60 + m
}
