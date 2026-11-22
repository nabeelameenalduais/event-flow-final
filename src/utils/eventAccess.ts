import { supabase } from "../lib/supabase"
import { isOrganizerOfEvent } from "../services/organizerService"
import type { Profile, RoleName } from "../types"

/**
 * Single source of truth for "may this user manage this event?".
 *
 * Admins can manage everything. Organizers can manage the events they own,
 * events they were assigned to via event_organizers, and — when
 * manages_all_events is set — every event. Fails closed on any lookup error.
 */
export async function canManageEvent(
  eventId: string,
  profile: Profile | null,
  role: RoleName | null,
): Promise<boolean> {
  if (role === "admin") return true
  if (!profile) return false

  try {
    const { data: prof } = await supabase
      .from("profiles")
      .select("manages_all_events")
      .eq("id", profile.id)
      .maybeSingle()
    if (prof?.manages_all_events) return true

    return await isOrganizerOfEvent(eventId, profile.userId)
  } catch {
    return false
  }
}
