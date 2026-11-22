import { runtimeLocalizeMessage as localizeToast } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import { ArrowLeft, Star, Lock, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { Card, CardContent } from "../components/ui/card"
import { Loading } from "../components/ui/Loading"
import { StarRating, NumericRating } from "../components/ui/StarRating"
import { useAuth } from "../contexts/AuthContext"
import { getEventById } from "../services/eventService"
import {
  getEvaluationWithQuestions,
  hasAttendedEvent,
  hasSubmitted,
  submitEvaluation,
  type EvaluationWithQuestions,
} from "../services/evaluationService"

export function EventEvaluation() {
  const { t } = useLanguage()
  
  const { id } = useParams<{ id: string }>()
  const { profile, role } = useAuth()

  const [eventTitle, setEventTitle] = useState("")
  const [eventEnded, setEventEnded] = useState(false)
  const [evaluation, setEvaluation] = useState<EvaluationWithQuestions | null>(null)
  const [loading, setLoading] = useState(true)
  const [eligible, setEligible] = useState(false)
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)

  const [rating, setRating] = useState(0)
  const [isPublic, setIsPublic] = useState(true)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    (async () => {
      if (!id || !profile) { setLoading(false); return }
      try {
        const event = await getEventById(id)
        if (!event) { setLoading(false); return }
        setEventTitle(event.title)
        setEventEnded(new Date(event.endDate).getTime() < Date.now())

        const ev = await getEvaluationWithQuestions(id)
        setEvaluation(ev ?? null)
        if (ev) {
          const [attended, submitted] = await Promise.all([
            hasAttendedEvent(id, profile.id),
            hasSubmitted(ev.id, profile.id),
          ])
          setEligible(attended)
          setAlreadySubmitted(submitted)
        }
      } catch (e: any) {
        toast.error(localizeToast(e?.message ?? "Failed to load"))
      } finally {
        setLoading(false)
      }
    })()
  }, [id, profile])

  if (loading) return <Loading text={t("Loading evaluation...")} />

  if (!evaluation) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <Star size={48} className="mx-auto text-muted-foreground/30" />
        <h1 className="text-xl font-bold">{t("No evaluation available")}</h1>
        <p className="text-sm text-muted-foreground">{t("The organizer hasn't created an evaluation for this event yet.")}</p>
        <Link to={`/events/${id}`} className="inline-block"><Button variant="outline" className="gap-2"><ArrowLeft size={15} /> {t("Back to event")}</Button></Link>
      </div>
    )
  }

  if (alreadySubmitted || done) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <CheckCircle2 size={48} className="mx-auto text-green-500" />
        <h1 className="text-xl font-bold">{t("Thank you!")}</h1>
        <p className="text-sm text-muted-foreground">{t('Your evaluation for "{title}" has been recorded.', { title: eventTitle })}</p>
        <Link to={`/events/${id}`} className="inline-block"><Button variant="outline" className="gap-2"><ArrowLeft size={15} /> {t("Back to event")}</Button></Link>
      </div>
    )
  }

  if (!eventEnded) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <Lock size={48} className="mx-auto text-amber-500/40" />
        <h1 className="text-xl font-bold">{t("Evaluation opens after the event")}</h1>
        <p className="text-sm text-muted-foreground">{t('You\'ll be able to rate "{title}" once it ends.', { title: eventTitle })}</p>
        <Link to={`/events/${id}`} className="inline-block"><Button variant="outline" className="gap-2"><ArrowLeft size={15} /> {t("Back to event")}</Button></Link>
      </div>
    )
  }

  if (!eligible) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <Lock size={48} className="mx-auto text-muted-foreground/30" />
        <h1 className="text-xl font-bold">{t("Not eligible")}</h1>
        <p className="text-sm text-muted-foreground">{t("Only registered attendees with confirmed attendance can evaluate this event.")}</p>
        <Link to={`/events/${id}`} className="inline-block"><Button variant="outline" className="gap-2"><ArrowLeft size={15} /> {t("Back to event")}</Button></Link>
      </div>
    )
  }

  const handleSubmit = async () => {
    if (!evaluation || !profile) return
    if (rating === 0) { toast.error(t("Please provide a rating")); return }
    setSubmitting(true)
    try {
      await submitEvaluation(evaluation.id, profile.id, { answers, rating, isPublic })
      setDone(true)
      toast.success(t("Evaluation submitted"))
    } catch (err: any) {
      toast.error(localizeToast(err.message ?? "Failed to submit"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
      <Link to={`/events/${id}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={15} /> {t("Back to event")}
      </Link>
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">{evaluation.title}</h1>
        <p className="text-sm text-muted-foreground">{eventTitle}</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div>
            <p className="font-medium mb-2">{t("Overall rating")}</p>
            {evaluation.ratingType === "stars"
              ? <StarRating value={rating} onChange={setRating} />
              : <NumericRating value={rating} onChange={setRating} />}
          </div>

          {evaluation.questions.map((q) => (
            <div key={q.id}>
              <p className="font-medium mb-2">{q.question}</p>
              {q.questionType === "multiple_choice" ? (
                <div className="flex flex-wrap gap-2">
                  {q.options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        answers[q.id] === opt
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-input bg-background text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <textarea
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  rows={3}
                  placeholder={t("Your answer...")}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              )}
            </div>
          ))}

          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="font-medium">{t("Share publicly")}</p>
              <p className="text-sm text-muted-foreground">
                {evaluation.privacy === "public"
                  ? t("Show your name with this response. Anonymous keeps your identity hidden.")
                  : t("This evaluation is secret — responses stay anonymous by default.")}
              </p>
            </div>
            {evaluation.privacy === "public" && (
              <button
                type="button"
                role="switch"
                aria-checked={isPublic}
                onClick={() => setIsPublic(!isPublic)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${isPublic ? "bg-primary" : "bg-input"}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${isPublic ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting..." : t("Submit Evaluation")}
            </Button>
          </div>
        </CardContent>
      </Card>
      {role === "attendee" && <Badge variant="outline" className="text-xs">{t("Registered attendee —")} {eligible ? "eligible" : ""}</Badge>}
    </div>
  )
}
