import { NextResponse } from "next/server"
import { Timestamp } from "firebase-admin/firestore"
import { adminDb } from "@/lib/server/firebase-admin"
import { requirePermission, toHttpError } from "@/lib/server/permission-check"

const INITIAL_STATIC_FILENAMES: string[] = [
  "SSP01265.JPG",
  "SSP00797.JPG",
  "SSP00811.JPG",
  "SSP01269.JPG",
  "SSP00807.JPG",
  "SSP01262.JPG",
  "SSP00802.JPG",
  "SSP01275.JPG",
  "SSP00812.JPG",
  "SSP00813.JPG",
  "SSP00798.JPG",
  "SSP00806.JPG",
  "SSP01267.JPG",
  "SSP01270.JPG",
  "SSP01266.JPG",
  "SSP01263.JPG",
  "SSP01273.JPG",
  "SSP01327.JPG",
  "SSP01264.JPG",
  "SSP00810.JPG",
  "SSP00823.JPG",
  "SSP00799.JPG",
  "SSP00800.JPG",
  "SSP01271.JPG",
  "SSP01272.JPG",
  "SSP00818.JPG",
  "SSP01274.JPG",
  "SSP00805.JPG",
  "SSP01268.JPG",
]

export async function GET(request: Request) {
  try {
    await requirePermission(request, "CMS_EDIT")

    let snap = await adminDb
      .collection("gallery")
      .orderBy("createdAt", "desc")
      .limit(500)
      .get()

    // Seed initial static images from /public/images if gallery is empty
    if (snap.empty && INITIAL_STATIC_FILENAMES.length > 0) {
      const batch = adminDb.batch()
      const now = Timestamp.now()
      const colRef = adminDb.collection("gallery")
      INITIAL_STATIC_FILENAMES.forEach((name) => {
        const ref = colRef.doc()
        batch.set(ref, {
          imageUrl: `/images/${name}`,
          storagePath: "",
          title: "",
          description: "",
          uploadedBy: "seed",
          createdAt: now,
          updatedAt: now,
        })
      })
      await batch.commit()
      snap = await adminDb
        .collection("gallery")
        .orderBy("createdAt", "desc")
        .limit(500)
        .get()
    }

    const items = snap.docs.map((doc) => {
      const data = doc.data() || {}
      return {
        id: doc.id,
        imageUrl: String(data.imageUrl || ""),
        storagePath: String(data.storagePath || ""),
        title: String(data.title || ""),
        description: String(data.description || ""),
        uploadedBy: String(data.uploadedBy || ""),
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate().toISOString()
          : null,
        updatedAt: data.updatedAt?.toDate
          ? data.updatedAt.toDate().toISOString()
          : null,
      }
    })

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
    const ref = await adminDb.collection("gallery").add({
      imageUrl,
      storagePath,
      title,
      description,
      uploadedBy: uid,
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

