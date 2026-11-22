import { supabase } from "../lib/supabase"
import type { DeviceSession } from "../types"
import { isMissingFunction, isMissingRelation } from "../lib/supabaseErrors"

export function detectDeviceName(): string {
  if (typeof navigator === "undefined") return "Unknown device"
  const ua = navigator.userAgent
  const known = [
    ["Chrome", "Chrome"],
    ["Firefox", "Firefox"],
    ["Safari", "Safari"],
    ["Edg", "Edge"],
    ["Opera", "Opera"],
    ["MSIE", "Internet Explorer"],
  ] as const
  for (const [token, name] of known) {
    if (ua.includes(token)) return `${name} · ${detectOS(ua)}`
  }
  return `Browser · ${detectOS(ua)}`
}

function detectOS(ua: string): string {
  if (ua.includes("Windows")) return "Windows"
  if (ua.includes("Mac OS")) return "macOS"
  if (ua.includes("Android")) return "Android"
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS"
  if (ua.includes("Linux")) return "Linux"
  return "OS"
}

export function generateSessionToken(): string {
  return crypto.randomUUID()
}

// Session tokens are credentials: they are generated on the device, stored
// client-side, and never re-read from the database (the token column is not
// selectable by the client — see schema.sql). The session id/timestamps are
// generated here so no .select() round-trip is needed after the insert.
export async function createDeviceSession(userId: string): Promise<DeviceSession> {
  const now = new Date().toISOString()
  const session: DeviceSession = {
    id: crypto.randomUUID(),
    userId,
    deviceName: detectDeviceName(),
    ipAddress: "127.0.0.1",
    token: generateSessionToken(),
    lastActiveAt: now,
    createdAt: now,
  }
  const { error } = await supabase.from("device_sessions").insert({
    id: session.id,
    user_id: userId,
    device_name: session.deviceName,
    ip_address: session.ipAddress,
    token: session.token,
    last_active_at: now,
    created_at: now,
  })
  if (error && !isMissingRelation(error)) throw error
  return session
}

export interface SessionListItem {
  id: string
  deviceName: string
  ipAddress: string
  isCurrent: boolean
  lastActiveAt: string
  createdAt: string
}

export async function getDeviceSessions(userId: string, currentToken?: string): Promise<SessionListItem[]> {
  const { data, error } = await supabase.rpc("list_user_sessions", {
    p_user_id: userId,
    p_current_token: currentToken ?? "",
  })
  if (isMissingFunction(error)) return []
  if (error) throw error
  return ((data as any[]) ?? []).map((s) => ({
    id: s.id,
    deviceName: s.device_name,
    ipAddress: s.ip_address,
    isCurrent: s.is_current ?? false,
    lastActiveAt: s.last_active_at,
    createdAt: s.created_at,
  }))
}

export async function updateSessionActivity(id: string): Promise<void> {
  await supabase
    .from("device_sessions")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", id)
}

export async function deleteDeviceSession(userId: string, sessionId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("revoke_session_by_id", {
    p_user_id: userId,
    p_session_id: sessionId,
  })
  if (isMissingFunction(error)) return true
  if (error) throw error
  return !!data
}

export async function deleteAllDeviceSessions(userId: string, currentToken?: string): Promise<number> {
  const { data, error } = await supabase.rpc("revoke_other_sessions", {
    p_user_id: userId,
    p_current_token: currentToken ?? "",
  })
  if (isMissingFunction(error)) return 0
  if (error) throw error
  return Number(data ?? 0)
}
