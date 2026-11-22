import { describe, it, expect } from "vitest"
import { buildRegistrationTrends, classifyAttendeeEvents } from "../dashboardService"
import type { Event } from "../../types"

describe("buildRegistrationTrends", () => {
  it("returns seven trailing days, including empty ones, in local time", () => {
    const now = new Date(2026, 10, 18, 14, 30)
    const trends = buildRegistrationTrends(
      [
        new Date(2026, 10, 18, 9, 0).toISOString(),
        new Date(2026, 10, 18, 10, 0).toISOString(),
        new Date(2026, 10, 16, 12, 0).toISOString(),
        new Date(2026, 10, 11, 12, 0).toISOString(), // outside the 7-day window
      ],
      now,
    )

    expect(trends).toHaveLength(7)
    expect(trends.map((t) => t.label)).toEqual(["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed"])
    expect(trends[6].count).toBe(2)
    expect(trends[4].count).toBe(1)
    expect(trends.reduce((sum, t) => sum + t.count, 0)).toBe(3)
  })
})

describe("classifyAttendeeEvents", () => {
  const event = (id: string, startDate: string, endDate: string): Event => ({
    id,
    title: id,
    description: "",
    coverImageUrl: "",
    organizerId: "",
    venueId: "",
    capacity: 10,
    registrationDeadline: startDate,
    startDate,
    endDate,
    status: "published",
    visibility: "public",
    contactEmail: "",
    categoryId: "",
    eventType: "hybrid",
  })

  it("keeps in-progress events visible and separates them from upcoming and past", () => {
    const now = new Date("2026-11-18T12:00:00.000Z")
    const result = classifyAttendeeEvents(
      [
        event("upcoming", "2026-11-19T09:00:00.000Z", "2026-11-19T17:00:00.000Z"),
        event("ongoing", "2026-11-18T09:00:00.000Z", "2026-11-18T17:00:00.000Z"),
        event("past", "2026-11-17T09:00:00.000Z", "2026-11-17T17:00:00.000Z"),
      ],
      now,
    )

    expect(result.upcomingEvents.map((e) => e.id)).toEqual(["upcoming"])
    expect(result.ongoingEvents.map((e) => e.id)).toEqual(["ongoing"])
    expect(result.pastEvents.map((e) => e.id)).toEqual(["past"])
  })
})
