import { NextResponse } from "next/server"
import { adminDb } from "@/lib/server/firebase-admin"

export async function GET() {
  try {
    const snap = await adminDb
      .collection("gallery")
      .orderBy("createdAt", "desc")
      .limit(200)
      .get()

    const items = snap.docs.map((doc) => {
      const data = doc.data() || {}
      return {
        id: doc.id,
        imageUrl: String(data.imageUrl || ""),
        title: String(data.title || ""),
        description: String(data.description || ""),
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate().toISOString()
          : null,
      }
    })

    return NextResponse.json({ items })
  } catch (error) {
    console.error("[gallery] Failed to load gallery items", error)
    return NextResponse.json(
      { error: "Failed to load gallery" },
      { status: 500 }
    )
  }
}

