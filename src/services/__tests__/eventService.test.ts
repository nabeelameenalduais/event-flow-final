import { describe, it, expect } from "vitest"
import { getEvents, getEventById } from "../eventService"

describe("eventService", () => {
  it("getEvents returns only published non-deleted events", async () => {
    const result = await getEvents()
    expect(result.length).toBeGreaterThan(0)
    for (const e of result) {
      expect(e.status).toBe("published")
      expect(e.deletedAt).toBeUndefined()
    }
  }, 30000)

  it("getEventById returns event by id", async () => {
    const result = await getEventById("b1eebc99-9c0b-4ef8-bb6d-6bb9bd380c01")
    expect(result).toBeDefined()
    expect(result!.id).toBe("b1eebc99-9c0b-4ef8-bb6d-6bb9bd380c01")
  }, 30000)
})
