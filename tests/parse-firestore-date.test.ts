import { describe, expect, it } from "vitest"
import { parseFirestoreDate } from "@/lib/client/parse-firestore-date"

describe("parseFirestoreDate", () => {
  it("parses ISO strings", () => {
    const d = parseFirestoreDate("2026-03-20T14:30:00.000Z")
    expect(d?.getUTCFullYear()).toBe(2026)
  })

  it("parses seconds as number", () => {
    const d = parseFirestoreDate({ seconds: 1710937800, nanoseconds: 0 })
    expect(d).not.toBeNull()
  })

  it("parses _seconds (REST-style)", () => {
    const d = parseFirestoreDate({ _seconds: 1710937800, _nanoseconds: 0 })
    expect(d).not.toBeNull()
  })
})
