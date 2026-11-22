import { supabase } from "../lib/supabase"
import type { Venue } from "../types"

function mapVenue(v: Record<string, any>): Venue {
  return {
    id: v.id,
    name: v.name,
    address: v.address,
    capacity: v.capacity,
    facilities: v.facilities,
    imageUrls: v.image_urls ?? [],
    deletedAt: v.deleted_at ?? undefined,
  }
}

export async function getVenues(): Promise<Venue[]> {
  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .is("deleted_at", null)
    .order("name")
  if (error) throw error
  return (data ?? []).map(mapVenue)
}

export async function getVenueById(id: string): Promise<Venue | undefined> {
  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .eq("id", id)
    .single()
  if (error) throw error
  return data ? mapVenue(data) : undefined
}

export async function createVenue(data: Omit<Venue, "id">): Promise<Venue> {
  const { data: inserted, error } = await supabase
    .from("venues")
    .insert({
      name: data.name,
      address: data.address,
      capacity: data.capacity,
      facilities: data.facilities,
      image_urls: data.imageUrls,
    })
    .select()
    .single()
  if (error) throw error
  return mapVenue(inserted)
}

export async function updateVenue(id: string, data: Partial<Venue>): Promise<Venue | undefined> {
  const payload: Record<string, unknown> = {}
  if (data.name !== undefined) payload.name = data.name
  if (data.address !== undefined) payload.address = data.address
  if (data.capacity !== undefined) payload.capacity = data.capacity
  if (data.facilities !== undefined) payload.facilities = data.facilities
  if (data.imageUrls !== undefined) payload.image_urls = data.imageUrls
  const { data: updated, error } = await supabase
    .from("venues")
    .update(payload)
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return updated ? mapVenue(updated) : undefined
}

export async function deleteVenue(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("venues")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
  return true
}

export async function restoreVenue(id: string): Promise<Venue | undefined> {
  const { data, error } = await supabase
    .from("venues")
    .update({ deleted_at: null })
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data ? mapVenue(data) : undefined
}
