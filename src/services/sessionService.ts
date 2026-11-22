import { supabase } from "../lib/supabase"
import type { Session, Speaker } from "../types"
import { assertValidSessionTimes } from "../utils/eventDates"

function mapSession(s: Record<string, any>): Session {
  return {
    id: s.id,
    eventId: s.event_id,
    title: s.title,
    description: s.description,
    startTime: s.start_time,
    endTime: s.end_time,
    roomName: s.room_name,
  }
}

function mapSpeaker(s: Record<string, any>): Speaker {
  return {
    id: s.id,
    sessionId: s.session_id,
    name: s.name,
    bio: s.bio,
    imageUrl: s.image_url,
  }
}

export async function getSessionsByEvent(eventId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("event_id", eventId)
    .order("start_time")
  if (error) throw error
  return (data ?? []).map(mapSession)
}

export async function getSessionById(id: string): Promise<Session | undefined> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .single()
  if (error) throw error
  return data ? mapSession(data) : undefined
}

export async function createSession(data: Omit<Session, "id">): Promise<Session> {
  assertValidSessionTimes(data)
  const { data: inserted, error } = await supabase
    .from("sessions")
    .insert({
      event_id: data.eventId,
      title: data.title,
      description: data.description,
      start_time: data.startTime,
      end_time: data.endTime,
      room_name: data.roomName,
    })
    .select()
    .single()
  if (error) throw error
  return mapSession(inserted)
}

export async function updateSession(id: string, data: Partial<Session>): Promise<Session | undefined> {
  const payload: Record<string, unknown> = {}
  if (data.title !== undefined) payload.title = data.title
  if (data.description !== undefined) payload.description = data.description
  if (data.startTime !== undefined) payload.start_time = data.startTime
  if (data.endTime !== undefined) payload.end_time = data.endTime
  if (data.roomName !== undefined) payload.room_name = data.roomName

  // Validate the merged range so a partial update cannot invert start/end.
  if (data.startTime !== undefined || data.endTime !== undefined) {
    const { data: current, error: fetchError } = await supabase
      .from("sessions")
      .select("start_time, end_time")
      .eq("id", id)
      .maybeSingle()
    if (fetchError) throw fetchError
    if (!current) throw new Error("Session not found")
    assertValidSessionTimes({
      startTime: data.startTime ?? current.start_time,
      endTime: data.endTime ?? current.end_time,
    })
  }

  const { data: updated, error } = await supabase
    .from("sessions")
    .update(payload)
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return updated ? mapSession(updated) : undefined
}

export async function deleteSession(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("sessions")
    .delete()
    .eq("id", id)
  if (error) throw error
  return true
}

export async function getSpeakersBySession(sessionId: string): Promise<Speaker[]> {
  const { data, error } = await supabase
    .from("speakers")
    .select("*")
    .eq("session_id", sessionId)
  if (error) throw error
  return (data ?? []).map(mapSpeaker)
}

export async function createSpeaker(data: Omit<Speaker, "id">): Promise<Speaker> {
  const { data: inserted, error } = await supabase
    .from("speakers")
    .insert({
      session_id: data.sessionId,
      name: data.name,
      bio: data.bio,
      image_url: data.imageUrl,
    })
    .select()
    .single()
  if (error) throw error
  return mapSpeaker(inserted)
}

export async function updateSpeaker(id: string, data: Partial<Speaker>): Promise<Speaker | undefined> {
  const payload: Record<string, unknown> = {}
  if (data.name !== undefined) payload.name = data.name
  if (data.bio !== undefined) payload.bio = data.bio
  if (data.imageUrl !== undefined) payload.image_url = data.imageUrl
  const { data: updated, error } = await supabase
    .from("speakers")
    .update(payload)
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return updated ? mapSpeaker(updated) : undefined
}

export async function deleteSpeaker(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("speakers")
    .delete()
    .eq("id", id)
  if (error) throw error
  return true
}

export async function detectConflicts(eventId: string, newStart: string, newEnd: string, excludeId?: string): Promise<Session[]> {
  let query = supabase
    .from("sessions")
    .select("*")
    .eq("event_id", eventId)
    .lt("start_time", newEnd)
    .gt("end_time", newStart)
  if (excludeId) {
    query = query.neq("id", excludeId)
  }
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(mapSession)
}
