import { supabase } from "../lib/supabase"
import type { Feedback } from "../types"

function mapFeedback(f: Record<string, any>): Feedback {
  return {
    id: f.id,
    eventId: f.event_id,
    attendeeId: f.attendee_id,
    rating: f.rating,
    comment: f.comment,
    submittedAt: f.submitted_at,
    response: f.response ?? undefined,
    respondedAt: f.responded_at ?? undefined,
  }
}

export async function getFeedbackByEvent(eventId: string): Promise<Feedback[]> {
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .eq("event_id", eventId)
    .order("submitted_at", { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapFeedback)
}

export async function getFeedbackByAttendee(attendeeId: string): Promise<Feedback[]> {
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .eq("attendee_id", attendeeId)
  if (error) throw error
  return (data ?? []).map(mapFeedback)
}

export async function submitFeedback(data: Omit<Feedback, "id" | "response" | "respondedAt">): Promise<Feedback> {
  const { data: existing } = await supabase
    .from("feedback")
    .select("id")
    .eq("event_id", data.eventId)
    .eq("attendee_id", data.attendeeId)
    .maybeSingle()
  if (existing) throw new Error("You have already submitted feedback for this event")

  const { data: inserted, error } = await supabase
    .from("feedback")
    .insert({
      event_id: data.eventId,
      attendee_id: data.attendeeId,
      rating: data.rating,
      comment: data.comment,
    })
    .select()
    .single()
  if (error) throw error
  return mapFeedback(inserted)
}

export async function respondToFeedback(feedbackId: string, response: string): Promise<Feedback | undefined> {
  const { data, error } = await supabase
    .from("feedback")
    .update({ response, responded_at: new Date().toISOString() })
    .eq("id", feedbackId)
    .select()
    .single()
  if (error) throw error
  return data ? mapFeedback(data) : undefined
}

export async function getFeedbackForOrganizer(organizerId: string): Promise<(Feedback & { eventTitle: string })[]> {
  const { data: events } = await supabase
    .from("events")
    .select("id, title")
    .eq("organizer_id", organizerId)

  if (!events || events.length === 0) return []

  const eventIds = events.map((e) => e.id)
  const eventTitles = Object.fromEntries(events.map((e) => [e.id, e.title]))

  const { data: feedbacks, error } = await supabase
    .from("feedback")
    .select("*")
    .in("event_id", eventIds)
    .order("submitted_at", { ascending: false })

  if (error) throw error
  return (feedbacks ?? []).map((f) => ({ ...mapFeedback(f), eventTitle: eventTitles[f.event_id] ?? "Unknown" }))
}
