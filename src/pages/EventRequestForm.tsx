import { runtimeLocalizeMessage as localizeToast } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Send } from "lucide-react"
import { toast } from "sonner"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { useAuth } from "../contexts/AuthContext"
import { createEventRequest } from "../services/eventRequestService"
import { getCategories } from "../services/categoryService"
import { getVenues } from "../services/venueService"
import { fromDateTimeLocal, nextMinuteDateTimeLocal } from "../utils/eventDates"
import type { Category, EventType, Venue } from "../types"

export function EventRequestForm() {
  const { t } = useLanguage()
  
  const navigate = useNavigate()
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [eventType, setEventType] = useState<EventType>("in_person")
  const [method, setMethod] = useState("")
  const [targetAudience, setTargetAudience] = useState("")
  const [expectedAttendees, setExpectedAttendees] = useState(50)
  const [trainerName, setTrainerName] = useState("")
  const [trainerBio, setTrainerBio] = useState("")
  const [trainerContact, setTrainerContact] = useState("")
  const [preferredStart, setPreferredStart] = useState("")
  const [preferredEnd, setPreferredEnd] = useState("")
  const [venueId, setVenueId] = useState("")
  const [estimatedBudget, setEstimatedBudget] = useState("")
  const [currencyCode, setCurrencyCode] = useState("USD")

  useEffect(() => {
    Promise.all([getCategories(), getVenues()]).then(([c, v]) => {
      setCategories(c)
      setVenues(v)
    }).catch(() => undefined)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    // Validation is app-level so messages follow the selected language
    // instead of the browser chrome locale.
    const errors: string[] = []
    if (!title.trim()) errors.push(t("Event title is required"))
    if (!description.trim()) errors.push(t("Please describe the event"))
    if (preferredStart && preferredEnd && new Date(preferredEnd).getTime() <= new Date(preferredStart).getTime()) {
      errors.push(t("Preferred end must be after the preferred start"))
    }
    if (expectedAttendees < 1) errors.push(t("Expected attendees must be at least 1"))
    if (estimatedBudget && Number(estimatedBudget) < 0) errors.push(t("Amount cannot be negative"))
    if (errors.length > 0) {
      toast.error(errors[0])
      return
    }

    setSaving(true)
    try {
      await createEventRequest({
        title,
        description,
        categoryId: categoryId || undefined,
        eventType,
        method,
        targetAudience,
        expectedAttendees,
        trainerName,
        trainerBio,
        trainerContact,
        preferredStart: preferredStart ? fromDateTimeLocal(preferredStart) : undefined,
        preferredEnd: preferredEnd ? fromDateTimeLocal(preferredEnd) : undefined,
        venueId: venueId || undefined,
        estimatedBudget: estimatedBudget ? Number(estimatedBudget) : undefined,
        currencyCode,
      })
      toast.success(t("Event request submitted — an administrator will review it"))
      navigate("/dashboard/event-requests")
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to submit the request"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/event-requests")} className="gap-2">
        <ArrowLeft size={16} /> {t("Back to requests")}
      </Button>
      <div>
        <h1 className="text-2xl font-bold">{t("Request an event")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("Any registered user can suggest an event. An administrator reviews the request and creates the draft event with its core data.")}
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold">{t("Event idea")}</h2>
          <div>
            <label className="block text-sm font-medium mb-1">{t("Title")}</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder={t("Event title")} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("Description")}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={4}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
              placeholder={t("What is the event about?")} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("Category")}</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                <option value="">{t("Let the administrator choose")}</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("Event type")}</label>
              <select value={eventType} onChange={(e) => setEventType(e.target.value as EventType)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                <option value="in_person">{t("In person")}</option>
                <option value="online">{t("Online")}</option>
                <option value="hybrid">{t("Hybrid")}</option>
              </select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("Method / format")}</label>
              <Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder={t("Workshop, lecture, training...")} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("Target audience")}</label>
              <Input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder={t("Students, staff, public...")} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("Expected attendees")}</label>
              <Input type="number" min={1} value={expectedAttendees} onChange={(e) => setExpectedAttendees(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("Preferred venue")}</label>
              <select value={venueId} onChange={(e) => setVenueId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                <option value="">{t("Not decided")}</option>
                {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("Preferred start")}</label>
              <Input type="datetime-local" value={preferredStart} onChange={(e) => setPreferredStart(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("Preferred end")}</label>
              <Input type="datetime-local" value={preferredEnd} min={nextMinuteDateTimeLocal(preferredStart)}
                onChange={(e) => setPreferredEnd(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold">{t("Trainer / presenter")}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("Name")}</label>
              <Input value={trainerName} onChange={(e) => setTrainerName(e.target.value)} placeholder={t("Full name")} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("Trainer contact")}</label>
              <Input value={trainerContact} onChange={(e) => setTrainerContact(e.target.value)} placeholder={t("Email or phone")} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("Short bio")}</label>
            <textarea value={trainerBio} onChange={(e) => setTrainerBio(e.target.value)} rows={3}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
              placeholder={t("Background and experience")} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold">{t("Estimated budget")}</h2>
          <p className="text-sm text-muted-foreground">{t("You can propose a budget; the administrator can adjust it during review.")}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("Amount")}</label>
              <Input type="number" min={0} step="0.01" value={estimatedBudget} onChange={(e) => setEstimatedBudget(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("Currency")}</label>
              <select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                <option value="USD">USD</option>
                <option value="YER">YER</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate("/dashboard/event-requests")}>{t("Cancel")}</Button>
          <Button type="submit" disabled={saving} className="gap-2">
            <Send size={16} /> {saving ? t("Submitting...") : t("Submit request")}
          </Button>
        </div>
      </form>
    </div>
  )
}
