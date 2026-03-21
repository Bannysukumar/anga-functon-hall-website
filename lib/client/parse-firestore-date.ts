/**
 * Parse Firestore Timestamp / JSON-serialized timestamp / ISO string to Date (client-safe).
 * NextResponse.json() often yields { seconds, nanoseconds } or string seconds.
 */
export function parseFirestoreDate(value: unknown): Date | null {
  if (value == null || value === "") return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === "string") {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof value === "object" && value !== null) {
    const o = value as Record<string, unknown>
    if (typeof o.toDate === "function") {
      try {
        const d = (o as { toDate: () => Date }).toDate()
        return Number.isNaN(d.getTime()) ? null : d
      } catch {
        return null
      }
    }
    const secRaw = o.seconds ?? o._seconds
    const sec =
      typeof secRaw === "number"
        ? secRaw
        : typeof secRaw === "string"
          ? Number(secRaw)
          : NaN
    const nanRaw = o.nanoseconds ?? o._nanoseconds
    const nan =
      typeof nanRaw === "number"
        ? nanRaw
        : typeof nanRaw === "string"
          ? Number(nanRaw)
          : 0
    if (Number.isFinite(sec)) {
      return new Date(sec * 1000 + (Number.isFinite(nan) ? nan / 1e6 : 0))
    }
  }
  return null
}
