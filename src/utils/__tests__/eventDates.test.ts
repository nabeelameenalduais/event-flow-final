import { describe, expect, it } from "vitest"
import {
  fromDateTimeLocal,
  getEventDateErrors,
  getSessionTimeErrors,
  toDateTimeLocal,
  validateEventDates,
  validateSessionTimes,
} from "../eventDates"

const range = (registrationDeadline: string, startDate: string, endDate: string) => ({
  registrationDeadline,
  startDate,
  endDate,
})

describe("event date validation", () => {
  it("accepts deadline <= start < end", () => {
    expect(validateEventDates(range("2026-11-01T09:00", "2026-11-05T09:00", "2026-11-06T09:00"))).toBeNull()
  })

  it("allows the deadline to equal the start time", () => {
    expect(validateEventDates(range("2026-11-05T09:00", "2026-11-05T09:00", "2026-11-06T09:00"))).toBeNull()
  })

  it("rejects an end time equal to or before the start time", () => {
    const equalEnd = getEventDateErrors(range("2026-11-01T09:00", "2026-11-05T09:00", "2026-11-05T09:00"))
    expect(equalEnd.endDate).toBeDefined()
    expect(equalEnd.registrationDeadline).toBeUndefined()

    const invertedEnd = getEventDateErrors(range("2026-10-01T09:00", "2026-11-05T09:00", "2026-11-01T09:00"))
    expect(invertedEnd.endDate).toBeDefined()
  })

  it("rejects a registration deadline after the start time", () => {
    const errors = getEventDateErrors(range("2026-11-10T09:00", "2026-11-05T09:00", "2026-11-06T09:00"))
    expect(errors.registrationDeadline).toBeDefined()
    expect(errors.endDate).toBeUndefined()
  })

  it("rejects missing or unparseable dates", () => {
    expect(getEventDateErrors(range("", "2026-11-05T09:00", "2026-11-06T09:00")).registrationDeadline).toBeDefined()
    expect(getEventDateErrors(range("not-a-date", "2026-11-05T09:00", "2026-11-06T09:00")).registrationDeadline).toBeDefined()
  })
})

describe("session time validation", () => {
  it("accepts end after start", () => {
    expect(validateSessionTimes({ startTime: "2026-11-05T09:00", endTime: "2026-11-05T10:00" })).toBeNull()
  })

  it("rejects end equal to or before start", () => {
    expect(getSessionTimeErrors({ startTime: "2026-11-05T09:00", endTime: "2026-11-05T09:00" }).endTime).toBeDefined()
    expect(getSessionTimeErrors({ startTime: "2026-11-05T10:00", endTime: "2026-11-05T09:00" }).endTime).toBeDefined()
  })

  it("rejects missing times", () => {
    expect(getSessionTimeErrors({ startTime: "", endTime: "2026-11-05T10:00" }).startTime).toBeDefined()
  })
})

describe("datetime-local conversion", () => {
  it("round-trips a local datetime value without shifting the clock", () => {
    const local = "2026-11-05T09:30"
    expect(toDateTimeLocal(fromDateTimeLocal(local))).toBe(local)
  })
})
