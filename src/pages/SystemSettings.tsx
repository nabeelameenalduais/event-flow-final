import { runtimeLocalizeMessage as localizeToast } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect, useCallback } from "react"
import { Save, Palette, Globe, Mail } from "lucide-react"
import { toast } from "sonner"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Textarea } from "../components/ui/textarea"
import { Label } from "../components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Loading } from "../components/ui/Loading"
import { getSettings, updateSettings, updateEmailTemplate } from "../services/settingsService"
import { useSettings } from "../contexts/SettingsContext"
import type { AppSettings, EmailTemplate } from "../types"

const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  check_in: "Check In",
  event_reminder: "Event Reminder",
  event_update: "Event Update",
  registration_confirmation: "Registration Confirmation",
}

export function SystemSettings() {
  const { t } = useLanguage()
  
  const { refreshSettings } = useSettings()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const s = await getSettings()
      setSettings(s)
    } catch (e: any) {
      setLoadError(true)
      toast.error(localizeToast(e?.message ?? "Failed to load settings"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSaveGeneral = async () => {
    if (!settings) return
    setSaving("general")
    try {
      const saved = await updateSettings({ appName: settings.appName, timezone: settings.timezone, dateFormat: settings.dateFormat })
      setSettings(saved)
      await refreshSettings()
      toast.success(t("General settings saved"))
    } catch (e: any) {
      toast.error(localizeToast(e?.message ?? "Failed to save general settings"))
    } finally {
      setSaving("")
    }
  }

  const handleSaveBranding = async () => {
    if (!settings) return
    setSaving("branding")
    try {
      const saved = await updateSettings({ primaryColor: settings.primaryColor, logoUrl: settings.logoUrl, faviconUrl: settings.faviconUrl })
      setSettings(saved)
      await refreshSettings()
      toast.success(t("Branding settings saved"))
    } catch (e: any) {
      toast.error(localizeToast(e?.message ?? "Failed to save branding settings"))
    } finally {
      setSaving("")
    }
  }

  const handleSaveTemplate = async (tmpl: EmailTemplate) => {
    setSaving(tmpl.id)
    try {
      await updateEmailTemplate(tmpl.id, { subject: tmpl.subject, body: tmpl.body })
      toast.success(t('Template "{type}" saved', { type: t(TEMPLATE_TYPE_LABELS[tmpl.type] ?? tmpl.type.replace(/_/g, " ")) }))
    } catch (e: any) {
      toast.error(localizeToast(e?.message ?? "Failed to save template"))
    } finally {
      setSaving("")
    }
  }

  if (loading) return <Loading text={t("Loading settings...")} />
  if (loadError || !settings) {
    return (
      <Card role="alert">
        <CardHeader><CardTitle>{t("Couldn't load settings")}</CardTitle></CardHeader>
        <CardContent>
          <Button className="mt-4" onClick={load}>{t("Try again")}</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("System Settings")}</h1>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general" className="gap-2"><Globe size={16} />  {t("General")}</TabsTrigger>
          <TabsTrigger value="branding" className="gap-2"><Palette size={16} />  {t("Branding")}</TabsTrigger>
          <TabsTrigger value="email" className="gap-2"><Mail size={16} /> {t("Email Templates")}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">{t("General Settings")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("Application Name")}</Label>
                <Input value={settings.appName} onChange={(e) => setSettings({ ...settings, appName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t("Timezone")}</Label>
                <Input value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t("Date Format")}</Label>
                <Input value={settings.dateFormat} onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value })} />
              </div>
              <Button onClick={handleSaveGeneral} disabled={saving === "general"}>
                <Save size={14} /> {saving === "general" ? t("Saving...") : t("Save")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">{t("Branding")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("Primary Color")}</Label>
                <div className="flex gap-3 items-center">
                  <input type="color" value={settings.primaryColor} onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })} className="w-10 h-10 rounded border border-border cursor-pointer" />
                  <Input value={settings.primaryColor} onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })} className="font-mono" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("Logo URL")}</Label>
                <Input value={settings.logoUrl} onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label>{t("Favicon URL")}</Label>
                <Input value={settings.faviconUrl} onChange={(e) => setSettings({ ...settings, faviconUrl: e.target.value })} placeholder="https://..." />
              </div>
              <Button onClick={handleSaveBranding} disabled={saving === "branding"}>
                <Save size={14} /> {saving === "branding" ? t("Saving...") : t("Save")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="mt-4 space-y-4">
          {settings.emailTemplates.map((tmpl) => (
            <Card key={tmpl.id}>
              <CardHeader><CardTitle className="text-base">{t(TEMPLATE_TYPE_LABELS[tmpl.type] ?? tmpl.type.replace(/_/g, " "))}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("Subject")}</Label>
                  <Input value={tmpl.subject} onChange={(e) => {
                    const updated = settings.emailTemplates.map((t) => t.id === tmpl.id ? { ...t, subject: e.target.value } : t)
                    setSettings({ ...settings, emailTemplates: updated })
                  }} />
                </div>
                <div className="space-y-2">
                  <Label>{t("Body")}</Label>
                  <Textarea value={tmpl.body} onChange={(e) => {
                    const updated = settings.emailTemplates.map((t) => t.id === tmpl.id ? { ...t, body: e.target.value } : t)
                    setSettings({ ...settings, emailTemplates: updated })
                  }} rows={5} />
                </div>
                <Button size="sm" onClick={() => handleSaveTemplate(tmpl)} disabled={saving === tmpl.id}>
                  <Save size={14} /> {saving === tmpl.id ? t("Saving...") : t("Save Template")}
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
