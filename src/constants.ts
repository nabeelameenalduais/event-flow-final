export const APP_NAME = "EventFlow"
export const APP_TAGLINE = "Discover & Manage Events"

export const EVENT_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const

export const EVENT_VISIBILITY = {
  PUBLIC: "public",
  PRIVATE: "private",
} as const

export const REGISTRATION_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  WAITLISTED: "waitlisted",
} as const

export const TICKET_STATUS = {
  VALID: "valid",
  USED: "used",
  INVALID: "invalid",
} as const

export const ROLES = {
  ADMIN: "admin",
  ORGANIZER: "organizer",
  ATTENDEE: "attendee",
} as const

export const NOTIFICATION_TYPES = {
  EVENT_REMINDER: "event_reminder",
  REGISTRATION_CONFIRMATION: "registration_confirmation",
  EVENT_UPDATE: "event_update",
  CHECK_IN: "check_in",
  CHAT_MESSAGE: "chat_message",
  INVITATION: "invitation",
  INVITATION_USED: "invitation_used",
  WAITLIST_PROMOTION: "waitlist_promotion",
  WAITLIST: "waitlist",
  EVALUATION: "evaluation",
  BAN_NOTICE: "ban_notice",
  BAN_REQUEST: "ban_request",
  BAN_APPROVED: "ban_approved",
  EVENT_REQUEST: "event_request",
  EVENT_REQUEST_UPDATE: "event_request_update",
  ADMIN_MESSAGE: "admin_message",
  ACCOUNT_DELETION: "account_deletion",
  ACCOUNT_RESTORED: "account_restored",
  PASSWORD_RESET: "password_reset",
  FINANCE: "finance",
  EXPENSE_APPROVAL: "expense_approval",
  FUNDING: "funding",
  REGISTRATION_REMOVED: "registration_removed",
} as const

export const EVENT_TYPES = {
  IN_PERSON: "in_person",
  ONLINE: "online",
  HYBRID: "hybrid",
} as const

export const ATTENDANCE_MODES = {
  IN_PERSON: "in_person",
  ONLINE: "online",
} as const

export const ATTENDANCE_SOURCES = {
  MANUAL: "manual",
  QR_SCAN: "qr_scan",
  AUTO_PRESENCE: "auto_presence",
  AUTO_JOIN: "auto_join",
} as const

export const DEFAULT_MEETING_ATTENDANCE_MINUTES = 10

/**
 * Recovery window before a deleted account is flagged for cleanup. Operators
 * can override the 30-day default with VITE_ACCOUNT_DELETION_GRACE_DAYS.
 */
export const DEFAULT_ACCOUNT_DELETION_GRACE_DAYS = (() => {
  const raw = (import.meta.env?.VITE_ACCOUNT_DELETION_GRACE_DAYS as string | undefined)?.trim()
  const parsed = raw ? Number(raw) : Number.NaN
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 30
})()

export const CAMPAIGN_STATUSES = {
  DRAFT: "draft",
  SCHEDULED: "scheduled",
  SENDING: "sending",
  SENT: "sent",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const

export const BAN_SCOPES = {
  GLOBAL: "global",
  EVENT: "event",
  CATEGORY: "category",
} as const

export const EVENT_REQUEST_STATUSES = {
  PENDING: "pending",
  REVIEWING: "reviewing",
  APPROVED: "approved",
  REJECTED: "rejected",
  NEEDS_INFO: "needs_info",
} as const

export const EXPENSE_CATEGORIES = [
  "venue",
  "catering",
  "transport",
  "technology",
  "printing",
  "marketing",
  "honorarium",
  "equipment",
  "other",
] as const

export const COST_TYPES = {
  PLANNED: "planned",
  ACTUAL: "actual",
} as const

export const COST_NEED_TYPES = [
  "catering",
  "cleaning",
  "furniture",
  "technology",
  "decoration",
  "printing",
  "transport",
  "security",
  "other",
] as const

export const RATING_TYPES = {
  NUMERIC: "numeric",
  STARS: "stars",
} as const

export const EVALUATION_PRIVACY = {
  SECRET: "secret",
  PUBLIC: "public",
} as const

export const MOCK_DELAY = {
  SHORT: 200,
  MEDIUM: 500,
  LONG: 1000,
} as const

export const DEMO_ACCOUNTS = [
  { role: "Admin", email: "admin@eventflow.com", password: "one" },
  { role: "Organizer", email: "organizer@eventflow.com", password: "one" },
  { role: "Attendee", email: "attendee@eventflow.com", password: "one" },
] as const
