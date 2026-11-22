import { supabase } from "../lib/supabase"
import type { Category } from "../types"

function mapCategory(c: Record<string, any>): Category {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    iconUrl: c.icon_url,
    colorCode: c.color_code,
    deletedAt: c.deleted_at ?? undefined,
  }
}

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .is("deleted_at", null)
    .order("name")
  if (error) throw error
  return (data ?? []).map(mapCategory)
}

export async function getCategoryById(id: string): Promise<Category | undefined> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("id", id)
    .single()
  if (error) throw error
  return data ? mapCategory(data) : undefined
}

export async function createCategory(data: { name: string; description: string; iconUrl: string; colorCode: string }): Promise<Category> {
  const { data: inserted, error } = await supabase
    .from("categories")
    .insert({ name: data.name, description: data.description, icon_url: data.iconUrl, color_code: data.colorCode })
    .select()
    .single()
  if (error) throw error
  return mapCategory(inserted)
}

export async function updateCategory(id: string, data: Partial<Category>): Promise<Category | undefined> {
  const payload: Record<string, unknown> = {}
  if (data.name !== undefined) payload.name = data.name
  if (data.description !== undefined) payload.description = data.description
  if (data.iconUrl !== undefined) payload.icon_url = data.iconUrl
  if (data.colorCode !== undefined) payload.color_code = data.colorCode
  const { data: updated, error } = await supabase
    .from("categories")
    .update(payload)
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return updated ? mapCategory(updated) : undefined
}

export async function deleteCategory(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("categories")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
  return true
}

export async function restoreCategory(id: string): Promise<Category | undefined> {
  const { data, error } = await supabase
    .from("categories")
    .update({ deleted_at: null })
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data ? mapCategory(data) : undefined
}
