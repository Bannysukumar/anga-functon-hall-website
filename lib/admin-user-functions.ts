async function getAuthHeader() {
  const { auth } = await import("@/lib/firebase")
  const user = auth.currentUser
  if (!user) throw new Error("Please login first.")
  const token = await user.getIdToken()
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
}

export async function adminCreateUser(payload: {
  name: string
  email: string
  mobileNumber: string
  role: string
}) {
  const response = await fetch("/api/admin/users", {
    method: "POST",
    headers: await getAuthHeader(),
    body: JSON.stringify(payload),
  })
  const data = (await response.json()) as { ok?: boolean; error?: string; emailSent?: boolean; warning?: string }
  if (!response.ok) throw new Error(data.error || "Failed to create user")
  return { ok: Boolean(data.ok), emailSent: Boolean(data.emailSent), warning: String(data.warning || "") }
}

export async function adminResendCredentials(userId: string, mode: "resend" | "reset" = "resend") {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/credentials`, {
    method: "POST",
    headers: await getAuthHeader(),
    body: JSON.stringify({ mode }),
  })
  const data = (await response.json()) as { ok?: boolean; error?: string; emailSent?: boolean; warning?: string }
  if (!response.ok) throw new Error(data.error || "Failed to send credentials")
  return { ok: Boolean(data.ok), emailSent: Boolean(data.emailSent), warning: String(data.warning || "") }
}

export async function adminSetUserStatus(userId: string, isBlocked: boolean) {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
    method: "PATCH",
    headers: await getAuthHeader(),
    body: JSON.stringify({ isBlocked }),
  })
  const data = (await response.json()) as { ok?: boolean; error?: string }
  if (!response.ok) throw new Error(data.error || "Failed to update status")
  return { ok: Boolean(data.ok) }
}

export async function adminEditUser(userId: string, payload: {
  name: string
  email: string
  mobileNumber: string
  role: string
}) {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: await getAuthHeader(),
    body: JSON.stringify(payload),
  })
  const data = (await response.json()) as { ok?: boolean; error?: string }
  if (!response.ok) throw new Error(data.error || "Failed to edit user")
  return { ok: Boolean(data.ok) }
}
