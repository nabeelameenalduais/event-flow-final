import { supabase } from "../lib/supabase"
import type { AuditLog, AuditAction } from "../types"

function mapAuditLog(l: Record<string, any>): AuditLog {
  return {
    id: l.id,
    userId: l.user_id,
    action: l.action,
    entityType: l.entity_type,
    entityId: l.entity_id,
    details: l.details,
    ipAddress: l.ip_address,
    createdAt: l.created_at,
  }
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapAuditLog)
}

export async function getAuditLogsByUser(userId: string): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapAuditLog)
}

export async function logAction(
  userId: string,
  action: AuditAction,
  entityType: string,
  entityId: string,
  details: string,
  ipAddress = "127.0.0.1",
): Promise<AuditLog> {
  const { data, error } = await supabase
    .from("audit_logs")
    .insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      ip_address: ipAddress,
    })
    .select()
    .single()
  if (error) throw error
  return mapAuditLog(data)
}
