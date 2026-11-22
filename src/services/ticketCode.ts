import type { AttendanceMode } from "../types"

export const PAYLOAD_PREFIX = "EF1:"

const CODE_PREFIX = "EF-"
// Ambiguous characters (I, O, 0, 1) are omitted so codes are easy to read aloud.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export interface TicketPayload {
  v: 1
  code: string
  eventId?: string
  registrationId?: string
  mode?: AttendanceMode
}

export interface TicketIdentity {
  code: string
  eventId?: string
  registrationId?: string
}

export type PayloadVerificationError = "code_mismatch" | "registration_mismatch" | "event_mismatch"

function toBase64Url(text: string): string {
  const base64 = btoa(unescape(encodeURIComponent(text)))
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function fromBase64Url(text: string): string {
  const normalized = text.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4)
  return decodeURIComponent(escape(atob(padded)))
}

/**
 * Cryptographically random, human-readable ticket code.
 * 12 base32 characters give ~60 bits of entropy, so collisions and guessing
 * are not practical. Unlike a timestamp, this is unique even for two tickets
 * created in the same millisecond.
 */
export function generateUniqueCode(): string {
  const bytes = new Uint8Array(12)
  const webCrypto = (globalThis as { crypto?: Crypto }).crypto
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  let suffix = ""
  for (const byte of bytes) suffix += CODE_ALPHABET[byte % CODE_ALPHABET.length]
  return `${CODE_PREFIX}${suffix}`
}

/** Encodes the ticket into one scannable/typeable string. */
export function encodeTicketCode(payload: TicketPayload): string {
  return `${PAYLOAD_PREFIX}${toBase64Url(JSON.stringify(payload))}`
}

/**
 * Accepts either the encoded payload (QR scan) or the plain unique code
 * (manual entry) and always returns a usable ticket code.
 */
export function decodeTicketCode(value: string): { code: string; payload?: TicketPayload } {
  const trimmed = value.trim()
  if (!trimmed) return { code: "" }
  if (!trimmed.startsWith(PAYLOAD_PREFIX)) return { code: trimmed }
  try {
    const parsed = JSON.parse(fromBase64Url(trimmed.slice(PAYLOAD_PREFIX.length))) as TicketPayload
    if (!parsed.code) return { code: trimmed }
    return { code: parsed.code, payload: parsed }
  } catch {
    return { code: trimmed }
  }
}

/** Builds the canonical payload used for both display and scanning. */
export function buildTicketPayload(input: {
  code: string
  eventId?: string
  registrationId?: string
  mode?: AttendanceMode
}): TicketPayload {
  return {
    v: 1,
    code: input.code,
    eventId: input.eventId,
    registrationId: input.registrationId,
    mode: input.mode,
  }
}

/**
 * Checks that a scanned payload actually describes the ticket it resolved to.
 * A missing payload (plain manual code) is allowed — the database row itself
 * is still checked against the expected event by the caller.
 */
export function verifyTicketPayload(
  payload: TicketPayload | undefined,
  expected: TicketIdentity,
): PayloadVerificationError | null {
  if (!payload) return null
  if (payload.code && expected.code && payload.code !== expected.code) return "code_mismatch"
  if (payload.registrationId && expected.registrationId && payload.registrationId !== expected.registrationId) {
    return "registration_mismatch"
  }
  if (payload.eventId && expected.eventId && payload.eventId !== expected.eventId) return "event_mismatch"
  return null
}
