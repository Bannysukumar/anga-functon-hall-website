import { NextResponse } from "next/server"
import { Timestamp } from "firebase-admin/firestore"
import { adminDb, adminStorage } from "@/lib/server/firebase-admin"
import { requirePermission, toHttpError } from "@/lib/server/permission-check"

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, "CMS_EDIT")
    const { id } = await context.params
    const body = await request.json()

    const docRef = adminDb.collection("gallery").doc(id)
    const snap = await docRef.get()
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const data = snap.data() || {}

    const updates: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    }

    if (typeof body.title === "string") {
      updates.title = body.title.trim()
    }
    if (typeof body.description === "string") {
      updates.description = body.description.trim()
    }

    let newStoragePath = String(body.storagePath || "").trim()
    let newImageUrl = String(body.imageUrl || "").trim()
    const oldStoragePath = String(data.storagePath || "").trim()

    if (newStoragePath && newStoragePath !== oldStoragePath) {
      updates.storagePath = newStoragePath
      if (newImageUrl) {
        updates.imageUrl = newImageUrl
      }
      if (oldStoragePath) {
        try {
          await adminStorage.bucket().file(oldStoragePath).delete()
        } catch (err) {
          console.error("[admin/gallery] Failed to delete old image", err)
        }
      }
    }

    await docRef.update(updates)
    const updatedSnap = await docRef.get()
    const updated = updatedSnap.data() || {}

    return NextResponse.json({
      id,
      imageUrl: String(updated.imageUrl || newImageUrl || ""),
      storagePath: String(updated.storagePath || newStoragePath || ""),
      title: String(updated.title || ""),
      description: String(updated.description || ""),
      uploadedBy: String(updated.uploadedBy || ""),
      createdAt: updated.createdAt?.toDate
        ? updated.createdAt.toDate().toISOString()
        : null,
      updatedAt: updated.updatedAt?.toDate
        ? updated.updatedAt.toDate().toISOString()
        : null,
    })
  } catch (error) {
    const http = toHttpError(error)
    return NextResponse.json({ error: http.error }, { status: http.status })
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, "CMS_EDIT")
    const { id } = await context.params

    const docRef = adminDb.collection("gallery").doc(id)
    const snap = await docRef.get()
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const data = snap.data() || {}
    const storagePath = String(data.storagePath || "").trim()

    if (storagePath) {
      try {
        await adminStorage.bucket().file(storagePath).delete()
      } catch (err) {
        console.error("[admin/gallery] Failed to delete storage file", err)
      }
    }

    await docRef.delete()
    return NextResponse.json({ success: true })
  } catch (error) {
    const http = toHttpError(error)
    return NextResponse.json({ error: http.error }, { status: http.status })
  }
}

