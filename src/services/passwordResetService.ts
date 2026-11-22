import { supabase } from "../lib/supabase"
import { getSessionToken } from "../lib/session"
import { isMissingFunction, isMissingRelation } from "../lib/supabaseErrors"
import { sendEmail, getEmailProvider, textToHtml } from "./emailService"
import { sendNotification } from "./notificationService"
import { getAdminUserIds } from "./userService"
import type { PasswordResetRequestItem } from "../types"

const UNAVAILABLE = "This feature needs the database upgrade. Run supabase/migrations/2026-11-06_all_additions.sql first."

export interface OtpRequestResult {
  ok: boolean
  code?: string
  expiresAt?: string
  emailSent: boolean
}

function parseRpc<T>(data: unknown, error: unknown, fallback: string): T {
  if (isMissingFunction(error)) throw new Error(UNAVAILABLE)
  if (error) throw new Error((error as { message?: string }).message ?? fallback)
  if (!data) throw new Error(fallback)
  const payload = data as { error?: string } & Record<string, unknown>
  if (payload.error) throw new Error(payload.error)
  return data as T
}

/** Cryptographically strong temporary password with letters, digits and symbols. */
export function generateStrongPassword(length = 14): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
  const lower = "abcdefghijkmnopqrstuvwxyz"
  const digits = "23456789"
  const symbols = "!@#$%^&*"
  const all = upper + lower + digits + symbols
  const charset = all.length
  const values = new Uint32Array(length)
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(values)
  } else {
    for (let i = 0; i < length; i += 1) values[i] = Math.floor(Math.random() * 0xffffffff)
  }
  const chars = Array.from(values, (value) => all[value % charset])
  // Guarantee at least one character of each class.
  chars[0] = upper[values[0] % upper.length]
  chars[1] = lower[values[1] % lower.length]
  chars[2] = digits[values[2] % digits.length]
  chars[3] = symbols[values[3] % symbols.length]
  return chars.join("")
}

/**
 * Requests a 6-digit code. The RPC stores only a bcrypt hash; the plain code is
 * returned once so it can be emailed (or displayed in mock mode).
 */
export async function requestPasswordOtp(email: string): Promise<OtpRequestResult> {
  const { data, error } = await supabase.rpc("request_password_otp", { p_email: email.trim().toLowerCase() })
  const result = parseRpc<{ ok: boolean; code?: string | null; expires_at?: string | null }>(data, error, "Failed to request a code")
  const code = result.code ?? undefined
  let emailSent = false
  if (code) {
    const sent = await sendEmail({
      to: email.trim(),
      subject: "EventFlow password reset code",
      body: textToHtml(`Your EventFlow verification code is ${code}.\n\nIt expires in 10 minutes. If you did not request it, ignore this email.`),
    })
    emailSent = sent.ok && getEmailProvider() !== "mock"
  }
  return {
    ok: true,
    code,
    expiresAt: result.expires_at ?? undefined,
    emailSent,
  }
}

export async function verifyPasswordOtp(email: string, code: string, newPassword: string): Promise<void> {
  if (newPassword.length < 8) throw new Error("Password must be at least 8 characters")
  const { data, error } = await supabase.rpc("verify_password_otp", {
    p_email: email.trim().toLowerCase(),
    p_code: code.trim(),
    p_new_password: newPassword,
  })
  parseRpc<{ ok: boolean }>(data, error, "Failed to reset password")
}

/** Creates a request that an administrator can resolve manually. */
export async function requestAdminPasswordReset(email: string, message: string): Promise<void> {
  const { data, error } = await supabase.rpc("request_admin_password_reset", {
    p_email: email.trim().toLowerCase(),
    p_message: message,
  })
  parseRpc<{ ok: boolean }>(data, error, "Failed to send the request")

  if (!message.trim()) return
  try {
    const admins = await getAdminUserIds()
    await Promise.all(
      admins.map((admin) =>
        sendNotification(
          admin.userId,
          "password_reset",
          `A password reset request was submitted for ${email.trim()}.`,
          "/dashboard/admin/password-resets",
        ).catch(() => undefined),
      ),
    )
  } catch {
    // best-effort
  }
}

function mapResetRequest(row: Record<string, any>): PasswordResetRequestItem {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    email: row.email,
    message: row.message ?? "",
    status: row.status,
    handledBy: row.handled_by ?? undefined,
    handledAt: row.handled_at ?? undefined,
    adminNote: row.admin_note ?? "",
    createdAt: row.created_at,
  }
}

export async function getPasswordResetRequests(status?: "pending" | "resolved" | "rejected"): Promise<PasswordResetRequestItem[]> {
  let query = supabase.from("password_reset_requests").select("*").order("created_at", { ascending: false })
  if (status) query = query.eq("status", status)
  const { data, error } = await query
  if (error && isMissingRelation(error)) return []
  if (error) throw error
  return (data ?? []).map(mapResetRequest)
}

/**
 * Resolves a manual request with an administrator-chosen (or generated)
 * temporary password. The user is forced to change it on first login and the
 * temporary password is delivered through the in-app notification inbox.
 */
export async function resolvePasswordResetRequest(
  requestId: string,
  temporaryPassword: string,
  adminNote?: string,
): Promise<{ userId: string; email: string }> {
  if (temporaryPassword.length < 8) throw new Error("Password must be at least 8 characters")
  const { data, error } = await supabase.rpc("resolve_admin_password_reset", {
    p_request_id: requestId,
    p_new_password: temporaryPassword,
    p_session_token: getSessionToken(),
    p_admin_note: adminNote ?? null,
  })
  const result = parseRpc<{ ok: boolean; user_id: string; email: string }>(data, error, "Failed to reset the password")

  if (result.user_id) {
    await sendNotification(
      result.user_id,
      "password_reset",
      `An administrator reset your password. Temporary password: ${temporaryPassword} — you must change it immediately after signing in.`,
      "/dashboard/change-password",
    ).catch(() => undefined)
  }
  return { userId: result.user_id, email: result.email }
}

export async function rejectPasswordResetRequest(requestId: string, adminId: string, note?: string): Promise<void> {
  const { error } = await supabase
    .from("password_reset_requests")
    .update({
      status: "rejected",
      handled_by: adminId,
      handled_at: new Date().toISOString(),
      admin_note: note ?? "",
    })
    .eq("id", requestId)
  if (error) throw error
}

/** Changes the signed-in user's password (also clears the forced-change flag). */
export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  if (newPassword.length < 8) throw new Error("Password must be at least 8 characters")
  const { data, error } = await supabase.rpc("change_password", {
    p_user_id: userId,
    p_current: currentPassword,
    p_new: newPassword,
  })
  parseRpc<{ ok: boolean }>(data, error, "Failed to change the password")
}

/** Administrator sets a temporary password directly for a user. */
export async function adminSetPassword(userId: string, password: string): Promise<void> {
  if (password.length < 8) throw new Error("Password must be at least 8 characters")
  const { data, error } = await supabase.rpc("admin_set_password", {
    p_user_id: userId,
    p_new_password: password,
    p_session_token: getSessionToken(),
  })
  parseRpc<{ ok: boolean }>(data, error, "Failed to set the password")

  await sendNotification(
    userId,
    "password_reset",
    `An administrator set a temporary password for your account: ${password}. You must change it after signing in.`,
    "/dashboard/change-password",
  ).catch(() => undefined)
}
