/** Shared date-time rules for events.
 *
 * Invariant: registration_deadline <= startDate < endDate
 * (registration may close exactly when the event starts, but not after).
 */

export interface EventDateRange {
  registrationDeadline: string | Date | null | undefined
  startDate: string | Date | null | undefined
  endDate: string | Date | null | undefined
}

export interface EventDateErrors {
  registrationDeadline?: string
  startDate?: string
  endDate?: string
}

function toTime(value: string | Date | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

export function getEventDateErrors(range: EventDateRange): EventDateErrors {
  const deadline = toTime(range.registrationDeadline)
  const start = toTime(range.startDate)
  const end = toTime(range.endDate)

  if (deadline === null || start === null || end === null) {
    return {
      registrationDeadline: "Enter a valid date and time",
      startDate: "Enter a valid date and time",
      endDate: "Enter a valid date and time",
    }
  }

  const errors: EventDateErrors = {}
  if (end <= start) {
    errors.endDate = "End date & time must be after the start date & time"
  }
  if (deadline > start) {
    errors.registrationDeadline = "Registration deadline must be on or before the start date & time"
  }
  return errors
}

export function validateEventDates(range: EventDateRange): string | null {
  return Object.values(getEventDateErrors(range))[0] ?? null
}

export function assertValidEventDates(range: EventDateRange): void {
  const message = validateEventDates(range)
  if (message) throw new Error(message)
}

/** Convert a stored UTC timestamp into the value expected by <input type="datetime-local">. */
export function toDateTimeLocal(value: string | Date | null | undefined): string {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (part: number) => String(part).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Convert a local datetime-local value into a UTC ISO string for storage. */
export function fromDateTimeLocal(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error("Enter a valid date and time")
  return date.toISOString()
}

/** Smallest valid `min` for an end-time input (one minute after `value`). */
export function nextMinuteDateTimeLocal(value: string): string | undefined {
  const time = toTime(value)
  return time === null ? undefined : toDateTimeLocal(new Date(time + 60_000))
}

/** Session times use the same ordering rule: start < end. */

export interface SessionTimeErrors {
  startTime?: string
  endTime?: string
}

export function getSessionTimeErrors(range: {
  startTime: string | Date | null | undefined
  endTime: string | Date | null | undefined
}): SessionTimeErrors {
  const start = toTime(range.startTime)
  const end = toTime(range.endTime)

  if (start === null || end === null) {
    return {
      startTime: "Enter a valid date and time",
      endTime: "Enter a valid date and time",
    }
  }
  if (end <= start) {
    return { endTime: "End time must be after the start time" }
  }
  return {}
}

export function validateSessionTimes(range: {
  startTime: string | Date | null | undefined
  endTime: string | Date | null | undefined
}): string | null {
  return Object.values(getSessionTimeErrors(range))[0] ?? null
}

export function assertValidSessionTimes(range: {
  startTime: string | Date | null | undefined
  endTime: string | Date | null | undefined
}): void {
  const message = validateSessionTimes(range)
  if (message) throw new Error(message)
}
