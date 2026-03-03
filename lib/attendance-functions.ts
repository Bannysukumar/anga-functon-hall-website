import { httpsCallable } from "firebase/functions"
import { functions } from "@/lib/firebase"

type SelfAttendancePayload = {
  lat: number
  lng: number
  accuracy: number
  deviceInfo: string
}

type SelfAttendanceResponse = {
  ok: boolean
  message: string
  dateKey: string
}

export async function createSelfAttendance(payload: SelfAttendancePayload) {
  const callable = httpsCallable<SelfAttendancePayload, SelfAttendanceResponse>(
    functions,
    "createSelfAttendance"
  )
  const result = await callable(payload)
  return result.data
}
