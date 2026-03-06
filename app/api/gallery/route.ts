import { NextResponse } from "next/server"
import { adminDb } from "@/lib/server/firebase-admin"

export async function GET() {
  try {
    const snap = await adminDb.collection("gallery").get()

    const items = snap.docs
      .map((doc) => {
        const data = doc.data() || {}
        return {
          id: doc.id,
          imageUrl: String(data.imageUrl || ""),
          title: String(data.title || ""),
          description: String(data.description || ""),
          sortOrder:
            typeof data.sortOrder === "number" ? (data.sortOrder as number) : 0,
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : null,
        }
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || (b.createdAt || "").localeCompare(a.createdAt || ""))

    return NextResponse.json({ items })
  } catch (error) {
    console.error("[gallery] Failed to load gallery items", error)
    return NextResponse.json(
      { error: "Failed to load gallery" },
      { status: 500 }
    )
  }
}

