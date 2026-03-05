/**
 * Refund policy: calculate refund amount based on advance paid, event date, and configurable rules.
 * Rules are applied in order; first rule where (days until event >= daysBefore) wins.
 * Amount is rounded to nearest integer.
 */

export type RefundRule = { daysBefore: number; percent: number }

const DEFAULT_RULES: RefundRule[] = [
  { daysBefore: 7, percent: 100 },
  { daysBefore: 3, percent: 50 },
  { daysBefore: 1, percent: 0 },
]

function getEventDate(value: unknown): Date | null {
  if (!value) return null
  const d =
    typeof (value as { toDate?: () => Date }).toDate === "function"
      ? (value as { toDate: () => Date }).toDate()
      : typeof (value as { seconds?: number }).seconds === "number"
        ? new Date((value as { seconds: number }).seconds * 1000)
        : typeof value === "string"
          ? new Date(value)
          : null
  return d && !Number.isNaN(d.getTime()) ? d : null
}

/**
 * Returns refund amount (same currency as advancePaid) and percent applied.
 * Rules should be sorted by daysBefore descending (e.g. 7, 3, 1) so that the first matching rule (days until event >= daysBefore) gives the percent.
 */
export function calculateRefundAmount(
  advancePaid: number,
  eventDate: unknown,
  rules: RefundRule[] = DEFAULT_RULES
): { amount: number; percent: number } {
  const advance = Math.max(0, Number(advancePaid) || 0)
  const event = getEventDate(eventDate)
  if (!event) return { amount: 0, percent: 0 }

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfEvent = new Date(event.getFullYear(), event.getMonth(), event.getDate())
  const daysUntilEvent = Math.ceil((startOfEvent.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000))

  const sorted = [...rules].sort((a, b) => b.daysBefore - a.daysBefore)
  let percent = 0
  for (const rule of sorted) {
    if (daysUntilEvent >= rule.daysBefore) {
      percent = Math.min(100, Math.max(0, rule.percent))
      break
    }
  }
  // When no rule matches (e.g. event in past, or 0 days before), default to full refund so refund amount is never 0 when advance was paid
  if (percent === 0 && advance > 0) {
    percent = 100
  }

  const amount = Math.round((advance * percent) / 100)
  return { amount, percent }
}
