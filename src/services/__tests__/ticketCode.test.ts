import { describe, expect, it } from "vitest"
import {
  buildTicketPayload,
  decodeTicketCode,
  encodeTicketCode,
  generateUniqueCode,
  verifyTicketPayload,
} from "../ticketCode"

const EVENT_ID = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380c01"
const REGISTRATION_ID = "c2ffcd00-1c1a-4ef8-bb6d-6bb9bd380c02"

describe("generateUniqueCode", () => {
  it("produces independently unique, readable codes", () => {
    const codes = Array.from({ length: 500 }, () => generateUniqueCode())
    expect(new Set(codes).size).toBe(codes.length)
    for (const code of codes) {
      expect(code).toMatch(/^EF-[A-HJ-NP-Z2-9]{12}$/)
    }
  })

  it("does not derive the code from a timestamp or title", () => {
    const first = generateUniqueCode()
    const second = generateUniqueCode()
    expect(first).not.toBe(second)
    expect(first).not.toContain("TECH")
  })
})

describe("ticket payload encoding", () => {
  it("round-trips identity fields", () => {
    const encoded = encodeTicketCode(buildTicketPayload({
      code: generateUniqueCode(),
      eventId: EVENT_ID,
      registrationId: REGISTRATION_ID,
      mode: "in_person",
    }))
    const decoded = decodeTicketCode(encoded)
    expect(decoded.payload).toEqual({
      v: 1,
      code: expect.stringMatching(/^EF-/),
      eventId: EVENT_ID,
      registrationId: REGISTRATION_ID,
      mode: "in_person",
    })
    expect(decoded.code).toBe(decoded.payload!.code)
  })

  it("accepts a plain manually typed code", () => {
    expect(decodeTicketCode("  ef-abcdefghijkl  ")).toEqual({ code: "ef-abcdefghijkl" })
  })

  it("treats a malformed payload as a plain code", () => {
    expect(decodeTicketCode("EF1:not-base64!!").payload).toBeUndefined()
    expect(decodeTicketCode("EF1:not-base64!!").code).toBe("EF1:not-base64!!")
  })
})

describe("verifyTicketPayload", () => {
  const expected = { code: "EF-ABCDEFGHIJKL", eventId: EVENT_ID, registrationId: REGISTRATION_ID }

  it("accepts a matching payload", () => {
    expect(verifyTicketPayload(buildTicketPayload(expected), expected)).toBeNull()
  })

  it("rejects a payload that points at another event", () => {
    const payload = buildTicketPayload({ ...expected, eventId: "00000000-0000-0000-0000-000000000000" })
    expect(verifyTicketPayload(payload, expected)).toBe("event_mismatch")
  })

  it("rejects a payload that points at another registration", () => {
    const payload = buildTicketPayload({ ...expected, registrationId: "00000000-0000-0000-0000-000000000000" })
    expect(verifyTicketPayload(payload, expected)).toBe("registration_mismatch")
  })

  it("rejects a payload whose code does not match the ticket", () => {
    const payload = buildTicketPayload({ ...expected, code: "EF-ZZZZZZZZZZZZ" })
    expect(verifyTicketPayload(payload, expected)).toBe("code_mismatch")
  })

  it("allows a plain code with no payload", () => {
    expect(verifyTicketPayload(undefined, expected)).toBeNull()
  })
})
