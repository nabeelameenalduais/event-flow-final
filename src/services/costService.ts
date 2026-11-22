import { supabase } from "../lib/supabase"
import type { EventCost, CostType } from "../types"

function mapCost(c: Record<string, any>): EventCost {
  return {
    id: c.id,
    eventId: c.event_id,
    costType: c.cost_type as CostType,
    item: c.item,
    needType: c.need_type,
    quantity: Number(c.quantity),
    unitPrice: Number(c.unit_price),
    notes: c.notes ?? null,
    createdBy: c.created_by,
    updatedBy: c.updated_by ?? undefined,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }
}

export async function getCostsByEvent(eventId: string, costType: CostType): Promise<EventCost[]> {
  const { data, error } = await supabase
    .from("event_costs")
    .select("*")
    .eq("event_id", eventId)
    .eq("cost_type", costType)
    .order("created_at")
  if (error) throw error
  return (data ?? []).map(mapCost)
}

export async function getAllCostsByEvent(eventId: string): Promise<{ planned: EventCost[]; actual: EventCost[] }> {
  const [planned, actual] = await Promise.all([
    getCostsByEvent(eventId, "planned"),
    getCostsByEvent(eventId, "actual"),
  ])
  return { planned, actual }
}

export async function createCost(
  eventId: string,
  costType: CostType,
  data: {
    item: string
    needType: string
    quantity: number
    unitPrice: number
    notes?: string
  },
  actorId: string,
): Promise<EventCost> {
  const { data: inserted, error } = await supabase
    .from("event_costs")
    .insert({
      event_id: eventId,
      cost_type: costType,
      item: data.item,
      need_type: data.needType,
      quantity: data.quantity,
      unit_price: data.unitPrice,
      notes: data.notes || null,
      created_by: actorId,
    })
    .select()
    .single()
  if (error) throw error
  return mapCost(inserted)
}

export async function updateCost(
  id: string,
  data: Partial<{
    item: string
    needType: string
    quantity: number
    unitPrice: number
    notes: string
  }>,
  actorId: string,
): Promise<EventCost | undefined> {
  const payload: Record<string, unknown> = { updated_by: actorId, updated_at: new Date().toISOString() }
  if (data.item !== undefined) payload.item = data.item
  if (data.needType !== undefined) payload.need_type = data.needType
  if (data.quantity !== undefined) payload.quantity = data.quantity
  if (data.unitPrice !== undefined) payload.unit_price = data.unitPrice
  if (data.notes !== undefined) payload.notes = data.notes

  const { data: updated, error } = await supabase
    .from("event_costs")
    .update(payload)
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return updated ? mapCost(updated) : undefined
}

export async function deleteCost(id: string): Promise<boolean> {
  const { error } = await supabase.from("event_costs").delete().eq("id", id)
  if (error) throw error
  return true
}

export function costLineTotal(c: EventCost): number {
  return c.quantity * c.unitPrice
}

export function sumCosts(costs: EventCost[]): number {
  return costs.reduce((s, c) => s + costLineTotal(c), 0)
}
