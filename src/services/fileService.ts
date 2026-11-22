import { supabase } from "../lib/supabase"
import type { FileItem } from "../types"

const BUCKET = "uploads"

function mapFile(f: Record<string, any>): FileItem {
  return {
    id: f.id,
    name: f.name,
    url: f.url,
    type: f.type,
    size: f.size,
    uploadedBy: f.uploaded_by,
    createdAt: f.created_at,
  }
}

/** Recover the object key from a public Supabase Storage URL. */
function storagePathFromUrl(url: string): string | null {
  const marker = `/${BUCKET}/`
  const index = url.indexOf(marker)
  if (index === -1) return null
  const raw = url.slice(index + marker.length).split("?")[0]
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function safeFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-120) || "file"
}

export async function getFiles(): Promise<FileItem[]> {
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapFile)
}

export async function getFileById(id: string): Promise<FileItem | undefined> {
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("id", id)
    .single()
  if (error) throw error
  return data ? mapFile(data) : undefined
}

export async function uploadFile(
  name: string,
  type: string,
  size: number,
  uploadedBy: string,
  file: File,
): Promise<FileItem> {
  // Keep the original name in the DB row, but use a unique, path-safe key in
  // storage so two uploads of the same file never overwrite each other.
  const filePath = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeFileName(name)}`
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      contentType: type || "application/octet-stream",
      upsert: false,
    })
  if (uploadError) throw uploadError

  const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(filePath)

  const { data, error } = await supabase
    .from("files")
    .insert({ name, url: publicUrl.publicUrl, type, size, uploaded_by: uploadedBy })
    .select()
    .single()
  if (error) {
    // Don't leave an orphaned object behind if the DB write fails.
    await supabase.storage.from(BUCKET).remove([filePath])
    throw error
  }
  return mapFile(data)
}

export async function deleteFile(id: string): Promise<boolean> {
  const { data: file } = await supabase
    .from("files")
    .select("url")
    .eq("id", id)
    .maybeSingle()

  const path = file ? storagePathFromUrl(file.url) : null
  if (path) await supabase.storage.from(BUCKET).remove([path])

  const { error } = await supabase
    .from("files")
    .delete()
    .eq("id", id)
  if (error) throw error
  return true
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function isImage(mime: string): boolean {
  return mime.startsWith("image/")
}
