import { NextResponse } from "next/server"
import { Timestamp } from "firebase-admin/firestore"
import { adminDb } from "@/lib/server/firebase-admin"
import { requirePermission, toHttpError } from "@/lib/server/permission-check"
import { createVisitorSchema, visitorsQuerySchema } from "@/lib/server/receptionist-schemas"
import { sanitizeText } from "@/lib/server/request-meta"

function normalizeDateKey(input: string) {
  const direct = String(input || "").match(/^(\d{4}-\d{2}-\d{2})/)
  if (direct?.[1]) return direct[1]
  const parsed = new Date(input)
  if (Number.isNaN(parsed.getTime())) return ""
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, "0")
  const day = String(parsed.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export async function GET(request: Request) {
  try {
    await requirePermission(request, "manage_visitors")
    const url = new URL(request.url)
    const query = visitorsQuerySchema.parse({
      status: url.searchParams.get("status") || "all",
      eventType: url.searchParams.get("eventType") || "all",
      from: url.searchParams.get("from") || "",
      to: url.searchParams.get("to") || "",
      search: url.searchParams.get("search") || "",
      limit: url.searchParams.get("limit") || 100,
    })

    const snap = await adminDb.collection("visitors").orderBy("createdAt", "desc").limit(1000).get()
    let items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    if (query.status !== "all") {
      items = items.filter((item) => String(item.status || "new") === query.status)
    }
    if (query.eventType !== "all") {
      items = items.filter((item) => String(item.eventType || "") === query.eventType)
    }
    if (query.search) {
      const needle = query.search.toLowerCase()
      items = items.filter((item) => {
        const name = String(item.name || "").toLowerCase()
        const phone = String(item.phone || "").toLowerCase()
        const notes = String(item.notes || "").toLowerCase()
        return name.includes(needle) || phone.includes(needle) || notes.includes(needle)
      })
    }
    if (query.from || query.to) {
      items = items.filter((item) => {
        const date = normalizeDateKey(String(item.preferredDate || ""))
        if (!date) return false
        if (query.from && date < query.from) return false
        if (query.to && date > query.to) return false
        return true
      })
    }
    return NextResponse.json({ items: items.slice(0, query.limit), total: items.length })
  } catch (error) {
    if ((error as { name?: string })?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid visitors query." }, { status: 422 })
    }
    const mapped = toHttpError(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}

export async function POST(request: Request) {
  try {
    const { uid } = await requirePermission(request, "manage_visitors")
    const body = createVisitorSchema.parse(await request.json())
    const preferredDate = normalizeDateKey(body.preferredDate)
    if (!preferredDate) {
      return NextResponse.json({ error: "Invalid preferred event date." }, { status: 400 })
    }
    const visitDate = normalizeDateKey(body.visitDate || "") || normalizeDateKey(new Date().toISOString())
    const ref = adminDb.collection("visitors").doc()
    await ref.set({
      name: sanitizeText(body.name, 120),
      phone: sanitizeText(body.phone, 20),
      eventType: sanitizeText(body.eventType, 60),
      preferredDate,
      visitDate,
      notes: sanitizeText(body.notes || "", 500),
      status: "new",
      createdBy: uid,
      convertedBookingId: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return NextResponse.json({ id: ref.id })
  } catch (error) {
    if ((error as { name?: string })?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid visitor payload." }, { status: 422 })
    }
    const mapped = toHttpError(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}
