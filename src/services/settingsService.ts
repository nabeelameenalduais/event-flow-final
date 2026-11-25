import { supabase } from "../lib/supabase"
import type { AppSettings, EmailTemplate } from "../types"

export async function getSettings(): Promise<AppSettings> {
  const { data: settings, error: settingsError } = await supabase
    .from("app_settings")
    .select("*")
    .limit(1)
    .maybeSingle()
  if (settingsError) throw settingsError

  const { data: templates, error: templatesError } = await supabase
    .from("email_templates")
    .select("*")
  if (templatesError) throw templatesError

  if (!settings) {
    return {
      appName: "EventFlow",
      timezone: "UTC",
      dateFormat: "MM/DD/YYYY",
      primaryColor: "#007bff",
      logoUrl: "",
      faviconUrl: "",
      emailTemplates: (templates ?? []).map(mapTemplate),
    }
  }

  return {
    appName: settings.app_name,
    timezone: settings.timezone,
    dateFormat: settings.date_format,
    primaryColor: settings.primary_color,
    logoUrl: settings.logo_url,
    faviconUrl: settings.favicon_url,
    emailTemplates: (templates ?? []).map(mapTemplate),
  }
}

export async function updateSettings(data: Partial<AppSettings>): Promise<AppSettings> {
  const payload: Record<string, unknown> = {}
  if (data.appName !== undefined) payload.app_name = data.appName
  if (data.timezone !== undefined) payload.timezone = data.timezone
  if (data.dateFormat !== undefined) payload.date_format = data.dateFormat
  if (data.primaryColor !== undefined) {
    payload.primary_color = data.primaryColor
    document.documentElement.style.setProperty("--primary", hexToHsl(data.primaryColor))
  }
  if (data.logoUrl !== undefined) payload.logo_url = data.logoUrl
  if (data.faviconUrl !== undefined) payload.favicon_url = data.faviconUrl

  const { data: settingsId, error: settingsIdError } = await supabase
    .from("app_settings")
    .select("id")
    .limit(1)
    .maybeSingle()
  if (settingsIdError) throw settingsIdError
  if (!settingsId) throw new Error("Settings record not found")

  const { error: updateError } = await supabase.from("app_settings").update(payload).eq("id", settingsId.id)
  if (updateError) throw updateError

  return getSettings()
}

export async function updateEmailTemplate(id: string, data: Partial<EmailTemplate>): Promise<EmailTemplate | undefined> {
  const payload: Record<string, unknown> = {}
  if (data.subject !== undefined) payload.subject = data.subject
  if (data.body !== undefined) payload.body = data.body

  const { data: updated, error } = await supabase
    .from("email_templates")
    .update(payload)
    .eq("id", id)
    .select()

  if (error) throw error
  return updated && updated.length > 0 ? mapTemplate(updated[0]) : undefined
}

function mapTemplate(t: Record<string, any>): EmailTemplate {
  return { id: t.id, type: t.type, subject: t.subject, body: t.body }
}

function hexToHsl(hex: string): string {
  let r = 0, g = 0, b = 0
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16)
    g = parseInt(hex[2] + hex[2], 16)
    b = parseInt(hex[3] + hex[3], 16)
  } else if (hex.length === 7) {
    r = parseInt(hex[1] + hex[2], 16)
    g = parseInt(hex[3] + hex[4], 16)
    b = parseInt(hex[5] + hex[6], 16)
  }
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0, l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return `${(h * 360).toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`
}
