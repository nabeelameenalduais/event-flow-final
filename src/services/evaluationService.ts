import { supabase } from "../lib/supabase"
import { isMissingFunction } from "../lib/supabaseErrors"
import type {
  Evaluation,
  EvaluationQuestion,
  EvaluationAnswer,
  RatingType,
  EvaluationPrivacy,
} from "../types"

export interface EvaluationWithQuestions extends Evaluation {
  questions: EvaluationQuestion[]
}

interface NewQuestion {
  question: string
  questionType: "multiple_choice" | "text"
  options: string[]
  sortOrder: number
}

function mapEvaluation(e: Record<string, any>): Evaluation {
  return {
    id: e.id,
    eventId: e.event_id,
    title: e.title,
    ratingType: e.rating_type as RatingType,
    privacy: e.privacy as EvaluationPrivacy,
    createdBy: e.created_by,
    createdAt: e.created_at,
  }
}

function mapQuestion(q: Record<string, any>): EvaluationQuestion {
  return {
    id: q.id,
    evaluationId: q.evaluation_id,
    question: q.question,
    questionType: q.question_type,
    options: Array.isArray(q.options) ? q.options : [],
    sortOrder: q.sort_order,
  }
}

export async function getEvaluationByEvent(eventId: string): Promise<Evaluation | undefined> {
  const { data, error } = await supabase
    .from("evaluations")
    .select("*")
    .eq("event_id", eventId)
    .maybeSingle()
  if (error) throw error
  return data ? mapEvaluation(data) : undefined
}

export async function getEvaluationWithQuestions(eventId: string): Promise<EvaluationWithQuestions | undefined> {
  const evalData = await getEvaluationByEvent(eventId)
  if (!evalData) return undefined

  const { data: qs, error } = await supabase
    .from("evaluation_questions")
    .select("*")
    .eq("evaluation_id", evalData.id)
    .order("sort_order")
  if (error) throw error

  return { ...evalData, questions: (qs ?? []).map(mapQuestion) }
}

export async function createEvaluation(
  eventId: string,
  data: {
    title: string
    ratingType: RatingType
    privacy: EvaluationPrivacy
    questions: NewQuestion[]
  },
  createdBy: string,
): Promise<Evaluation> {
  const existing = await getEvaluationByEvent(eventId)
  if (existing) throw new Error("This event already has an evaluation")

  const { data: inserted, error } = await supabase
    .from("evaluations")
    .insert({
      event_id: eventId,
      title: data.title,
      rating_type: data.ratingType,
      privacy: data.privacy,
      created_by: createdBy,
    })
    .select()
    .single()
  if (error) throw error

  if (data.questions.length > 0) {
    const rows = data.questions.map((q, i) => ({
      evaluation_id: inserted.id,
      question: q.question,
      question_type: q.questionType,
      options: q.questionType === "multiple_choice" ? q.options : null,
      sort_order: i,
    }))
    await supabase.from("evaluation_questions").insert(rows)
  }

  return mapEvaluation(inserted)
}

export async function updateEvaluation(
  eventId: string,
  data: {
    title?: string
    ratingType?: RatingType
    privacy?: EvaluationPrivacy
  },
): Promise<Evaluation | undefined> {
  const existing = await getEvaluationByEvent(eventId)
  if (!existing) throw new Error("Evaluation not found")

  const payload: Record<string, unknown> = {}
  if (data.title !== undefined) payload.title = data.title
  if (data.ratingType !== undefined) payload.rating_type = data.ratingType
  if (data.privacy !== undefined) payload.privacy = data.privacy

  const { data: updated, error } = await supabase
    .from("evaluations")
    .update(payload)
    .eq("id", existing.id)
    .select()
    .single()
  if (error) throw error
  return updated ? mapEvaluation(updated) : undefined
}

export async function updateEvaluationQuestions(
  evaluationId: string,
  questions: { question: string; questionType: "multiple_choice" | "text"; options: string[] }[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("evaluation_questions")
    .delete()
    .eq("evaluation_id", evaluationId)
  if (deleteError) throw deleteError

  if (questions.length > 0) {
    const rows = questions.map((q, i) => ({
      evaluation_id: evaluationId,
      question: q.question,
      question_type: q.questionType,
      options: q.questionType === "multiple_choice" ? q.options : null,
      sort_order: i,
    }))
    const { error: insertError } = await supabase.from("evaluation_questions").insert(rows)
    if (insertError) throw insertError
  }
}

export async function deleteEvaluation(eventId: string): Promise<boolean> {
  const existing = await getEvaluationByEvent(eventId)
  if (!existing) return false
  const { error } = await supabase.from("evaluations").delete().eq("id", existing.id)
  if (error) throw error
  return true
}

/**
 * Whether an attendee (profile id) attended the event with confirmed attendance.
 */
export async function hasAttendedEvent(eventId: string, attendeeProfileId: string): Promise<boolean> {
  const { data: reg } = await supabase
    .from("registrations")
    .select("id")
    .eq("event_id", eventId)
    .eq("attendee_id", attendeeProfileId)
    .eq("status", "confirmed")
    .maybeSingle()
  if (!reg) return false

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id")
    .eq("registration_id", reg.id)
    .maybeSingle()
  if (!ticket) return false

  const { data: attendance, error } = await supabase
    .from("attendance")
    .select("id")
    .eq("ticket_id", ticket.id)
    .maybeSingle()
  if (error) throw error
  return !!attendance
}

export async function hasSubmitted(evaluationId: string, attendeeProfileId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("evaluation_submissions")
    .select("id")
    .eq("evaluation_id", evaluationId)
    .eq("attendee_id", attendeeProfileId)
    .maybeSingle()
  if (error) throw error
  return !!data
}

export async function submitEvaluation(
  evaluationId: string,
  attendeeProfileId: string,
  data: {
    answers: Record<string, string>
    rating: number | null
    isPublic: boolean
  },
): Promise<boolean> {
  // Server-side enforcement (schema.sql): only confirmed attendees who actually
  // attended may submit, once per evaluation, and answers are stored atomically.
  const { data: result, error } = await supabase.rpc("submit_evaluation", {
    p_evaluation_id: evaluationId,
    p_attendee_id: attendeeProfileId,
    p_rating: data.rating,
    p_is_public: data.isPublic,
    p_answers: data.answers,
  })
  if (isMissingFunction(error)) throw new Error("Evaluation submission is not available yet — the database schema has not been upgraded")
  if (error) throw error
  if (result?.error) throw new Error(result.error)
  return true
}

export interface SubmissionResult {
  id: string
  attendeeId: string
  attendeeName: string
  rating: number | null
  isPublic: boolean
  createdAt: string
  answers: EvaluationAnswer[]
}

export async function getSubmissions(evaluationId: string, privacy: EvaluationPrivacy): Promise<SubmissionResult[]> {
  const { data: subs, error } = await supabase
    .from("evaluation_submissions")
    .select("*, profile:profiles(first_name, last_name)")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
  if (error) throw error

  const rows = (subs ?? []) as any[]
  const subIds = rows.map((s) => s.id)
  let answerMap: Record<string, EvaluationAnswer[]> = {}

  if (subIds.length > 0) {
    const { data: answers } = await supabase
      .from("evaluation_answers")
      .select("*")
      .in("submission_id", subIds)
    const grouped: Record<string, EvaluationAnswer[]> = {}
    for (const a of answers ?? []) {
      const key = a.submission_id
      if (!grouped[key]) grouped[key] = []
      grouped[key].push({
        id: a.id,
        submissionId: a.submission_id,
        questionId: a.question_id,
        answer: a.answer ?? null,
      })
    }
    answerMap = grouped
  }

  return rows.map((s) => {
    const showName = privacy === "public" && s.is_public
    return {
      id: s.id,
      attendeeId: s.attendee_id,
      attendeeName: showName
        ? `${s.profile?.first_name ?? ""} ${s.profile?.last_name ?? ""}`.trim() || "Attendee"
        : "Anonymous",
      rating: s.rating,
      isPublic: s.is_public,
      createdAt: s.created_at,
      answers: answerMap[s.id] ?? [],
    }
  })
}

export async function getEvaluationStats(evaluationId: string): Promise<{
  total: number
  averageRating: number | null
  ratingDistribution: { label: string; count: number }[]
}> {
  const { data, error } = await supabase
    .from("evaluation_submissions")
    .select("rating")
    .eq("evaluation_id", evaluationId)
  if (error) throw error

  const rows = (data ?? []) as any[]
  const ratings = rows.filter((r) => r.rating != null).map((r) => Number(r.rating))
  const total = rows.length
  const averageRating = ratings.length > 0
    ? +(ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1)
    : null

  const dist: Record<string, number> = {}
  for (const r of ratings) {
    const label = String(r)
    dist[label] = (dist[label] ?? 0) + 1
  }

  return {
    total,
    averageRating,
    ratingDistribution: Object.entries(dist).map(([label, count]) => ({ label, count })),
  }
}
