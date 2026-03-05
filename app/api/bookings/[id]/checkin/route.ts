import { NextResponse } from "next/server"
import { Timestamp } from "firebase-admin/firestore"
import { adminAuth, adminDb } from "@/lib/server/firebase-admin"

function readBearerToken(request: Request) {
  const auth = request.headers.get("authorization") || ""
  if (!auth.startsWith("Bearer ")) return ""
  return auth.slice("Bearer ".length).trim()
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = readBearerToken(request)
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const decoded = await adminAuth.verifyIdToken(token)
    const uid = decoded.uid
    const { id } = await params
    const ref = adminDb.collection("bookings").doc(id)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 })
    }
    const current = snap.data() || {}
    if (String(current.userId || "") !== uid) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 })
    }
    const status = String(current.status || "")
    if (status !== "confirmed") {
      return NextResponse.json(
        {
          error:
            status === "checked_in"
              ? "Already checked in."
              : "Only confirmed bookings can be checked in.",
        },
        { status: 409 }
      )
    }

    const now = Date.now()
    let scheduledCheckInAtMs: number | null = null
    const existingScheduled = (current.scheduledCheckInAt as { toDate?: () => Date } | undefined)?.toDate?.()
    if (existingScheduled) {
      scheduledCheckInAtMs = existingScheduled.getTime()
    } else {
      const settingsSnap = await adminDb.collection("settings").doc("global").get()
      const settings = (settingsSnap.data() || {}) as { defaultCheckInTime?: string }
      const checkInTime = String(settings.defaultCheckInTime || "12:00").trim() || "12:00"
      const checkInDate = (current.checkInDate as { toDate?: () => Date } | undefined)?.toDate?.()
      if (checkInDate) {
        const [h, m] = checkInTime.split(":").map(Number)
        const scheduled = new Date(checkInDate)
        scheduled.setHours(Number.isFinite(h) ? h : 12, Number.isFinite(m) ? m : 0, 0, 0)
        scheduledCheckInAtMs = scheduled.getTime()
      }
    }
    if (scheduledCheckInAtMs != null && now < scheduledCheckInAtMs) {
      return NextResponse.json(
        {
          error:
            "Check-in is not allowed before the scheduled check-in time. Please try again after the allowed time.",
        },
        { status: 409 }
      )
    }

    const updates = {
      status: "checked_in",
      checkInAt: Timestamp.now(),
      checkedInBy: uid,
      updatedAt: Timestamp.now(),
    }
    await ref.set(updates, { merge: true })

    await adminDb.collection("auditLogs").add({
      entity: "booking",
      entityId: id,
      action: "CHECKIN",
      message: "User checked in",
      payload: {},
      createdBy: uid,
      createdAt: Timestamp.now(),
    })

    return NextResponse.json({ ok: true, status: "checked_in" })
  } catch (err) {
    console.error("Check-in error", err)
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 })
  }
}
