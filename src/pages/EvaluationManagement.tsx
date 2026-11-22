import { runtimeLocalizeMessage as localizeToast } from "../i18n/runtimeLocale"
import { runtimeFormatDateTime as formatDateTime } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Plus, Trash2, BarChart3, ClipboardList } from "lucide-react"
import { toast } from "sonner"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Badge } from "../components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { useAuth } from "../contexts/AuthContext"
import { getEventById } from "../services/eventService"
import { canManageEvent } from "../utils/eventAccess"
import {
  getEvaluationWithQuestions,
  createEvaluation,
  updateEvaluation,
  updateEvaluationQuestions,
  deleteEvaluation,
  getSubmissions,
  getEvaluationStats,
  type EvaluationWithQuestions,
  type SubmissionResult,
} from "../services/evaluationService"
import { RATING_TYPES, EVALUATION_PRIVACY } from "../constants"
import type { RatingType, EvaluationPrivacy, EvaluationQuestionType } from "../types"

interface QuestionDraft {
  key: string
  question: string
  questionType: EvaluationQuestionType
  options: string[]
}

let qCounter = 0
const nextKey = () => `q_${++qCounter}`

export function EvaluationManagement() {
  const { t } = useLanguage()
  
  const { eventId } = useParams<{ eventId: string }>()
  const { user, profile, role } = useAuth()
  const navigate = useNavigate()

  const [eventTitle, setEventTitle] = useState("")
  const [eventEnded, setEventEnded] = useState(true)
  const [evaluation, setEvaluation] = useState<EvaluationWithQuestions | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<"builder" | "results">("results")

  // builder state
  const [title, setTitle] = useState("")
  const [ratingType, setRatingType] = useState<RatingType>("stars")
  const [privacy, setPrivacy] = useState<EvaluationPrivacy>("secret")
  const [questions, setQuestions] = useState<QuestionDraft[]>([])
  const [saving, setSaving] = useState(false)

  // results state
  const [submissions, setSubmissions] = useState<SubmissionResult[]>([])
  const [stats, setStats] = useState<{ total: number; averageRating: number | null; ratingDistribution: { label: string; count: number }[] } | null>(null)

  const fetch = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    try {
      const event = await getEventById(eventId)
      if (!event) { navigate("/dashboard/events"); return }
      if (!(await canManageEvent(eventId, profile, role))) { navigate("/dashboard/events"); return }
      setEventTitle(event.title)
      setEventEnded(new Date(event.endDate).getTime() < Date.now())

      const evalData = await getEvaluationWithQuestions(eventId)
      setEvaluation(evalData ?? null)
      if (evalData) {
        setTitle(evalData.title)
        setRatingType(evalData.ratingType)
        setPrivacy(evalData.privacy)
        setQuestions(evalData.questions.map((q) => ({
          key: nextKey(),
          question: q.question,
          questionType: q.questionType,
          options: q.options.length > 0 ? q.options : [""],
        })))
        loadResults(evalData)
      }
    } catch (e: any) {
      toast.error(localizeToast(e?.message ?? "Failed to load"))
    } finally {
      setLoading(false)
    }
  }, [eventId, navigate, profile, role])

  const loadResults = async (ev: EvaluationWithQuestions) => {
    try {
      const [subs, st] = await Promise.all([
        getSubmissions(ev.id, ev.privacy),
        getEvaluationStats(ev.id),
      ])
      setSubmissions(subs)
      setStats(st)
    } catch (e: any) {
      toast.error(localizeToast(e?.message ?? "Failed to load results"))
    }
  }

  useEffect(() => { fetch() }, [fetch])

  const addQuestion = () => {
    setQuestions((qs) => [...qs, { key: nextKey(), question: "", questionType: "multiple_choice", options: ["", ""] }])
  }

  const updateQuestion = (key: string, patch: Partial<QuestionDraft>) => {
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)))
  }

  const updateOption = (key: string, index: number, value: string) => {
    setQuestions((qs) => qs.map((q) =>
      q.key === key ? { ...q, options: q.options.map((o, i) => (i === index ? value : o)) } : q,
    ))
  }

  const addOption = (key: string) => {
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, options: [...q.options, ""] } : q)))
  }

  const removeQuestion = (key: string) => {
    setQuestions((qs) => qs.filter((q) => q.key !== key))
  }

  const handleSave = async () => {
    if (!eventId || !user || !profile) return
    if (!title.trim()) { toast.error(t("Please provide a title")); return }
    if (questions.some((q) => !q.question.trim())) { toast.error(t("Please fill in all questions")); return }
    for (const q of questions) {
      if (q.questionType === "multiple_choice" && q.options.filter((o) => o.trim()).length < 2) {
        toast.error(t("Multiple choice questions need at least 2 options")); return
      }
    }
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        ratingType,
        privacy,
        questions: questions.map((q) => ({
          question: q.question.trim(),
          questionType: q.questionType,
          options: q.questionType === "multiple_choice" ? q.options.filter((o) => o.trim()) : [],
          sortOrder: 0,
        })),
      }
      if (evaluation) {
        await updateEvaluation(eventId, { title: payload.title, ratingType, privacy })
        await updateEvaluationQuestions(evaluation.id, payload.questions)
        toast.success(t("Evaluation updated"))
      } else {
        await createEvaluation(eventId, payload, user.id)
        toast.success(t("Evaluation created"))
      }
      fetch()
    } catch (err: any) {
      toast.error(localizeToast(err.message ?? "Failed to save evaluation"))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!eventId || !evaluation) return
    try {
      await deleteEvaluation(eventId)
      toast.success(t("Evaluation deleted"))
      setEvaluation(null)
      setQuestions([])
      setSubmissions([])
    } catch {
      toast.error(t("Failed to delete evaluation"))
    }
  }

  if (loading) return <Loading text={t("Loading evaluation...")} />

  const maxDist = stats && stats.ratingDistribution.length > 0
    ? Math.max(...stats.ratingDistribution.map((d) => d.count))
    : 0

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/events")} className="gap-2">
        <ArrowLeft size={16} /> {t("Back to Events")}
      </Button>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("Evaluation:")} {eventTitle}</h1>
        {evaluation && (
          <Badge variant="secondary">{view === "builder" ? t("Editing") : t("{count} responses", { count: stats?.total ?? 0 })}</Badge>
        )}
      </div>

      {!eventEnded && (
        <p className="text-sm text-muted-foreground rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2">
          {t("Note: responses open to attendees only after the event ends — but you can build the evaluation now.")}
        </p>
      )}

      {evaluation && (
        <div className="flex gap-2">
          <Button size="sm" variant={view === "results" ? "default" : "outline"} className="gap-2" onClick={() => { setView("results"); loadResults(evaluation) }}>
            <BarChart3 size={15} />  {t("Results")}
          </Button>
          <Button size="sm" variant={view === "builder" ? "default" : "outline"} className="gap-2" onClick={() => setView("builder")}>
            <ClipboardList size={15} /> {t("Edit")}
          </Button>
        </div>
      )}

      {(!evaluation || view === "builder") && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <h2 className="font-semibold">{evaluation ? t("Edit evaluation") : t("Build evaluation")}</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("Title")}</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("How was the event?")} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("Rating Type")}</label>
              <select value={ratingType} onChange={(e) => setRatingType(e.target.value as RatingType)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                {Object.values(RATING_TYPES).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("Privacy")}</label>
              <select value={privacy} onChange={(e) => setPrivacy(e.target.value as EvaluationPrivacy)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                {Object.values(EVALUATION_PRIVACY).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">{t("Questions")}</p>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={addQuestion}>
                <Plus size={15} /> {t("Add question")}
              </Button>
            </div>
            {questions.length === 0 ? (
              <EmptyState title={t("No questions yet")} description={t("Add a multiple choice question or a text box.")} />
            ) : (
              questions.map((q, qi) => (
                <div key={q.key} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-2 text-sm font-semibold text-muted-foreground">{qi + 1}.</span>
                    <div className="flex-1 space-y-2">
                      <Input value={q.question} onChange={(e) => updateQuestion(q.key, { question: e.target.value })} placeholder={t("Question text")} />
                      <div className="flex gap-2">
                        <select value={q.questionType}
                          onChange={(e) => updateQuestion(q.key, { questionType: e.target.value as EvaluationQuestionType })}
                          className="px-3 py-1.5 rounded-lg border border-input bg-background text-sm">
                          <option value="multiple_choice">{t("Multiple choice")}</option>
                          <option value="text">{t("Text box")}</option>
                        </select>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeQuestion(q.key)}>
                          <Trash2 size={14} /> {t("Remove")}
                        </Button>
                      </div>
                      {q.questionType === "multiple_choice" && (
                        <div className="space-y-2 pl-6">
                          {q.options.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <Input value={opt} onChange={(e) => updateOption(q.key, oi, e.target.value)} placeholder={`Option ${oi + 1}`} />
                            </div>
                          ))}
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => addOption(q.key)}>
                            <Plus size={13} /> {t("Add option")}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2 justify-end">
            {evaluation && (
              <Button variant="outline" className="text-destructive" onClick={handleDelete}>{t("Delete evaluation")}</Button>
            )}
            <Button onClick={handleSave} disabled={saving}>{saving ? t("Saving...") : evaluation ? t("Update") : t("Create evaluation")}</Button>
          </div>
        </div>
      )}

      {evaluation && view === "results" && stats && (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">{t("Responses")}</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{stats.total}</p></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">{t("Average Rating")}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.averageRating != null ? stats.averageRating : t("—")}</p>
                <p className="text-xs text-muted-foreground">{t("across {ratingType} scale", { ratingType: evaluation.ratingType })}</p>
              </CardContent>
            </Card>
          </div>

          {stats.ratingDistribution.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">{t("Rating Distribution")}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {stats.ratingDistribution.map((d) => (
                  <div key={d.label} className="flex items-center gap-3">
                    <span className="w-8 text-sm font-medium text-muted-foreground">{d.label}</span>
                    <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-teal-500 to-amber-500"
                        style={{ width: maxDist > 0 ? `${(d.count / maxDist) * 100}%` : "0%" }}
                      />
                    </div>
                    <span className="w-8 text-sm font-semibold">{d.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">{t("Submissions")}</CardTitle></CardHeader>
            <CardContent>
              {submissions.length === 0 ? (
                <EmptyState title={t("No submissions yet")} description={t("Responses will appear here once attendees rate the event.")} />
              ) : (
                <div className="space-y-4">
                  {submissions.map((s) => (
                    <div key={s.id} className="rounded-lg border border-border p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{s.attendeeName}</p>
                        <div className="flex items-center gap-2">
                          {s.rating != null && <Badge variant="secondary">{s.rating}</Badge>}
                          <Badge variant={s.isPublic ? "outline" : "default"}>
                            {evaluation.privacy === "public" && s.isPublic ? "Public" : "Anonymous"}
                          </Badge>
                        </div>
                      </div>
                      {s.answers.length > 0 && (
                        <div className="space-y-1">
                          {s.answers.map((a) => {
                            const q = evaluation.questions.find((qq) => qq.id === a.questionId)
                            return (
                              <p key={a.id} className="text-sm">
                                <span className="text-muted-foreground">{q?.question ?? "Question"}:</span>{" "}
                                <span className="font-medium">{a.answer}</span>
                              </p>
                            )
                          })}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">{formatDateTime(s.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
