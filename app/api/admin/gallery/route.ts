import { NextResponse } from "next/server"
import { Timestamp } from "firebase-admin/firestore"
import { adminDb } from "@/lib/server/firebase-admin"
import { requirePermission, toHttpError } from "@/lib/server/permission-check"

export async function GET(request: Request) {
  try {
    await requirePermission(request, "CMS_EDIT")

    const snap = await adminDb.collection("gallery").get()

    const items = snap.docs
      .map((doc) => {
        const data = doc.data() || {}
        return {
          id: doc.id,
          imageUrl: String(data.imageUrl || ""),
          storagePath: String(data.storagePath || ""),
          title: String(data.title || ""),
          description: String(data.description || ""),
          uploadedBy: String(data.uploadedBy || ""),
          sortOrder:
            typeof data.sortOrder === "number" ? (data.sortOrder as number) : 0,
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : null,
          updatedAt: data.updatedAt?.toDate
            ? data.updatedAt.toDate().toISOString()
            : null,
        }
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || (b.createdAt || "").localeCompare(a.createdAt || ""))

    return NextResponse.json({ items })
  } catch (error) {
    const http = toHttpError(error)
    return NextResponse.json({ error: http.error }, { status: http.status })
  }
}

export async function POST(request: Request) {
  try {
    const { uid } = await requirePermission(request, "CMS_EDIT")
    const body = await request.json()

    const title = String(body.title || "").trim()
    const description = String(body.description || "").trim()
    const imageUrl = String(body.imageUrl || "").trim()
    const storagePath = String(body.storagePath || "").trim()

    if (!imageUrl || !storagePath) {
      return NextResponse.json(
        { error: "Image upload is required." },
        { status: 400 }
      )
    }
    if (!title) {
      return NextResponse.json(
        { error: "Title is required." },
        { status: 400 }
      )
    }

    const now = Timestamp.now()
    const galleryCol = adminDb.collection("gallery")
    const lastSnap = await galleryCol
      .orderBy("sortOrder", "desc")
      .limit(1)
      .get()
    const lastOrder =
      lastSnap.empty || typeof lastSnap.docs[0].data().sortOrder !== "number"
        ? 0
        : (lastSnap.docs[0].data().sortOrder as number)
    const ref = await galleryCol.add({
      imageUrl,
      storagePath,
      title,
      description,
      uploadedBy: uid,
      sortOrder: lastOrder + 1,
      createdAt: now,
      updatedAt: now,
    })

    return NextResponse.json(
      {
        id: ref.id,
        imageUrl,
        storagePath,
        title,
        description,
        uploadedBy: uid,
        sortOrder: lastOrder + 1,
        createdAt: now.toDate().toISOString(),
        updatedAt: now.toDate().toISOString(),
      },
      { status: 201 }
    )
  } catch (error) {
    const http = toHttpError(error)
    return NextResponse.json({ error: http.error }, { status: http.status })
  }
}

