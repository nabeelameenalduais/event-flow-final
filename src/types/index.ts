export type RoleName = "admin" | "organizer" | "attendee"

export interface Role {
  id: string
  name: RoleName
  description: string
}

export interface User {
  id: string
  email: string
  createdAt: string
  updatedAt: string
  suspended?: boolean
  mustChangePassword?: boolean
  deletedAt?: string
  scheduledDeletionAt?: string
  deletionReason?: string
}

export interface Profile {
  id: string
  userId: string
  firstName: string
  lastName: string
  phoneNumber: string
  avatarUrl: string
  roleId: string
  managesAllEvents?: boolean
}

export interface Category {
  id: string
  name: string
  description: string
  iconUrl: string
  colorCode: string
  deletedAt?: string
}

export interface Venue {
  id: string
  name: string
  address: string
  capacity: number
  facilities: Record<string, boolean>
  imageUrls: string[]
  deletedAt?: string
}

export type EventStatus = "draft" | "published" | "archived"
export type EventVisibility = "public" | "private"

export type EventType = "in_person" | "online" | "hybrid"
export type AttendanceMode = "in_person" | "online"

export interface Event {
  id: string
  title: string
  description: string
  coverImageUrl: string
  organizerId: string
  venueId: string
  capacity: number
  registrationDeadline: string
  startDate: string
  endDate: string
  status: EventStatus
  visibility: EventVisibility
  contactEmail: string
  categoryId: string
  eventType: EventType
  meetingLink?: string
  meetingLinkGeneratedBy?: string
  meetingLinkCreatedAt?: string
  onlineCapacity?: number
  inPersonCapacity?: number
  meetingProvider?: string
  meetingAttendanceMinutes?: number
  meetingRoomName?: string
  hybridNote?: string
  deletedAt?: string
}

export interface EventOrganizer {
  id: string
  eventId: string
  userId: string
  isPrimary: boolean
  createdAt: string
}

export type AuditAction = "create" | "update" | "delete" | "login" | "logout" | "register" | "suspend" | "activate" | "publish" | "archive" | "check_in" | "check_out" | "cancel"

export interface AuditLog {
  id: string
  userId: string
  action: AuditAction
  entityType: string
  entityId: string
  details: string
  ipAddress: string
  createdAt: string
}

export interface EventImage {
  id: string
  eventId: string
  imageUrl: string
  description: string
}

export interface Session {
  id: string
  eventId: string
  title: string
  description: string
  startTime: string
  endTime: string
  roomName: string
}

export interface Speaker {
  id: string
  sessionId: string
  name: string
  bio: string
  imageUrl: string
}

export interface InvitationLink {
  id: string
  eventId: string
  email: string
  code: string
  used: boolean
  usedAt: string | null
  createdAt: string
}

export type RegistrationStatus = "pending" | "confirmed" | "cancelled" | "waitlisted"

export interface Registration {
  id: string
  eventId: string
  attendeeId: string
  registeredAt: string
  status: RegistrationStatus
  attendanceMode?: AttendanceMode
}

export type TicketStatus = "valid" | "used" | "invalid"

export interface Ticket {
  id: string
  registrationId: string
  uniqueCode: string
  qrCodeUrl: string
  issuedAt: string
  status: TicketStatus
  qrPayload?: string
  attendanceMode?: AttendanceMode
  verifiedBy?: string
  verifiedAt?: string
  /** Set when the query joins the owning registration. */
  eventId?: string
  attendeeId?: string
}

export interface Attendance {
  id: string
  ticketId: string
  checkInTime: string
  checkOutTime?: string
  mode?: AttendanceMode
  source?: AttendanceSource
  verifiedBy?: string
  presenceSeconds?: number
}

export type AttendanceSource = "manual" | "qr_scan" | "auto_presence" | "auto_join"

export type NotificationType =
  | "event_reminder"
  | "registration_confirmation"
  | "event_update"
  | "check_in"
  | "chat_message"
  | "invitation"
  | "invitation_used"
  | "waitlist_promotion"
  | "waitlist"
  | "evaluation"
  | "ban_notice"
  | "ban_request"
  | "ban_approved"
  | "event_request"
  | "event_request_update"
  | "admin_message"
  | "account_deletion"
  | "account_restored"
  | "password_reset"
  | "finance"
  | "expense_approval"
  | "funding"
  | "registration_removed"

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  message: string
  readAt: string | null
  createdAt: string
  link?: string
}

export interface FileItem {
  id: string
  name: string
  url: string
  type: string
  size: number
  uploadedBy: string
  createdAt: string
}

export interface EmailTemplate {
  id: string
  type: string
  subject: string
  body: string
}

export interface AppSettings {
  appName: string
  timezone: string
  dateFormat: string
  primaryColor: string
  logoUrl: string
  faviconUrl: string
  emailTemplates: EmailTemplate[]
}

export interface Feedback {
  id: string
  eventId: string
  attendeeId: string
  rating: number
  comment: string
  submittedAt: string
  response?: string
  respondedAt?: string
}

// --- Chat ---
export type ChatChannelType = "general" | "private"

export interface ChatChannel {
  id: string
  eventId: string
  channelType: ChatChannelType
  organizerId: string | null
  attendeeId?: string | null
  createdAt: string
}

export interface ChatMessage {
  id: string
  channelId: string
  senderId: string
  content: string
  createdAt: string
}

export interface ChatMessageWithSender extends ChatMessage {
  senderName: string
  senderRole?: string
}

// --- Evaluations ---
export type RatingType = "numeric" | "stars"
export type EvaluationPrivacy = "secret" | "public"

export interface Evaluation {
  id: string
  eventId: string
  title: string
  ratingType: RatingType
  privacy: EvaluationPrivacy
  createdBy: string
  createdAt: string
}

export type EvaluationQuestionType = "multiple_choice" | "text"

export interface EvaluationQuestion {
  id: string
  evaluationId: string
  question: string
  questionType: EvaluationQuestionType
  options: string[]
  sortOrder: number
}

export interface EvaluationSubmission {
  id: string
  evaluationId: string
  attendeeId: string
  rating: number | null
  isPublic: boolean
  createdAt: string
}

export interface EvaluationAnswer {
  id: string
  submissionId: string
  questionId: string
  answer: string | null
}

// --- Costs ---
export type CostType = "planned" | "actual"

export interface EventCost {
  id: string
  eventId: string
  costType: CostType
  item: string
  needType: string
  quantity: number
  unitPrice: number
  notes: string | null
  createdBy: string
  updatedBy?: string
  createdAt: string
  updatedAt: string
}

// --- Device sessions ---
export interface DeviceSession {
  id: string
  userId: string
  deviceName: string
  ipAddress: string
  token?: string
  isCurrent?: boolean
  lastActiveAt: string
  createdAt: string
}

// --- Meetings / presence / in-meeting chat ---
export interface MeetingPresence {
  id: string
  eventId: string
  attendeeId: string
  userId?: string
  firstJoinedAt: string
  lastSeenAt: string
  totalSeconds: number
  isVisible: boolean
  attended: boolean
}

export interface MeetingChatMessage {
  id: string
  eventId: string
  senderId: string
  content: string
  createdAt: string
  senderName?: string
}

// --- Audience CRM ---
export type AudienceContactStatus = "subscribed" | "unsubscribed" | "deleted_account"

export interface AudienceContact {
  id: string
  email: string
  name: string
  phone: string
  tags: string[]
  source: string
  status: AudienceContactStatus
  userId?: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface AudienceAccessGrant {
  id: string
  userId: string
  canView: boolean
  canEdit: boolean
  canSend: boolean
  startsAt: string
  expiresAt?: string
  grantedBy?: string
  createdAt: string
}

export interface AudienceAccess {
  canView: boolean
  canEdit: boolean
  canSend: boolean
  isAdmin: boolean
  grant?: AudienceAccessGrant
}

// --- Email campaigns ---
export type CampaignTargetType = "all" | "tag" | "event" | "contacts"
export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "failed" | "cancelled"
export type RecipientStatusFilter = "confirmed" | "waitlisted" | "both"

export interface EmailCampaign {
  id: string
  name: string
  subject: string
  body: string
  targetType: CampaignTargetType
  targetEventId?: string
  targetTags: string[]
  targetContactIds: string[]
  recipientStatus: RecipientStatusFilter
  scheduledAt?: string
  status: CampaignStatus
  provider: string
  totalRecipients: number
  sentCount: number
  failedCount: number
  createdBy?: string
  createdAt: string
  sentAt?: string
}

export interface EmailCampaignRecipient {
  id: string
  campaignId: string
  contactId?: string
  email: string
  status: "pending" | "sent" | "failed" | "skipped"
  error?: string
  sentAt?: string
}

// --- Finance ---
export type FundingScope = "general" | "event" | "project"
export type ExpenseStatus = "pending" | "approved" | "rejected"

export interface Attachment {
  name: string
  url: string
  size?: number
}

export interface Currency {
  code: string
  name: string
  symbol: string
  ratePerUsd: number
  ratePerYer: number
  isActive: boolean
  updatedBy?: string
  updatedAt: string
}

export interface FundingSource {
  id: string
  name: string
  funderName: string
  scope: FundingScope
  eventId?: string
  projectName: string
  currencyCode: string
  amount: number
  ratePerUsd: number
  amountUsd: number
  receivedAt: string
  method: string
  reference: string
  attachments: Attachment[]
  notes: string
  status: "active" | "closed"
  createdBy?: string
  createdAt: string
}

export interface Expense {
  id: string
  eventId?: string
  fundingId?: string
  currencyCode: string
  ratePerUsd: number
  amount: number
  amountUsd: number
  beneficiary: string
  purpose: string
  category: string
  paymentMethod: string
  expenseDate: string
  attachments: Attachment[]
  status: ExpenseStatus
  requestedBy?: string
  approvedBy?: string
  approvedAt?: string
  rejectionReason?: string
  createdAt: string
}

export interface FundTransfer {
  id: string
  fundingId: string
  type: "to_general" | "refund"
  amount: number
  currencyCode: string
  ratePerUsd: number
  amountUsd: number
  toFundingId?: string
  refundTo: string
  notes: string
  attachments: Attachment[]
  createdBy?: string
  createdAt: string
}

export interface FinanceSummary {
  totalFundingUsd: number
  generalFundingUsd: number
  eventFundingUsd: number
  approvedExpensesUsd: number
  pendingExpensesUsd: number
  balanceUsd: number
  byCurrency: { currency: string; funding: number; expenses: number; balance: number }[]
}

// --- Bans ---
export type BanScope = "global" | "event" | "category"
export type BanStatus = "pending" | "active" | "rejected" | "revoked" | "expired"

export interface UserBan {
  id: string
  userId: string
  scope: BanScope
  eventId?: string
  categoryId?: string
  reason: string
  isPermanent: boolean
  expiresAt?: string
  notifyUser: boolean
  status: BanStatus
  requestedBy?: string
  approvedBy?: string
  approvedAt?: string
  revokedBy?: string
  revokedAt?: string
  revokeReason?: string
  createdAt: string
}

export interface BanRevokeRequest {
  id: string
  banId: string
  requestedBy?: string
  reason: string
  status: "pending" | "approved" | "rejected"
  handledBy?: string
  handledAt?: string
  createdAt: string
}

// --- Event requests ---
export type EventRequestStatus = "pending" | "reviewing" | "approved" | "rejected" | "needs_info"

export interface EventRequest {
  id: string
  requesterId: string
  title: string
  description: string
  categoryId?: string
  eventType: EventType
  method: string
  targetAudience: string
  expectedAttendees?: number
  trainerName: string
  trainerBio: string
  trainerContact: string
  preferredStart?: string
  preferredEnd?: string
  venueId?: string
  estimatedBudget?: number
  currencyCode: string
  attachments: Attachment[]
  status: EventRequestStatus
  adminNotes: string
  reviewedBy?: string
  reviewedAt?: string
  createdEventId?: string
  createdAt: string
}

// --- Admin broadcast ---
export type AdminMessageChannel = "in_app" | "email" | "both"
export type AdminMessageTarget = "all" | "event" | "users"

export interface AdminMessage {
  id: string
  title: string
  body: string
  link?: string
  channel: AdminMessageChannel
  targetType: AdminMessageTarget
  eventId?: string
  userIds: string[]
  recipientStatus: RecipientStatusFilter
  scheduledAt?: string
  status: CampaignStatus
  totalRecipients: number
  sentCount: number
  failedCount: number
  createdBy?: string
  createdAt: string
  sentAt?: string
}

export interface AdminMessageRecipient {
  id: string
  messageId: string
  userId?: string
  email?: string
  inAppSent: boolean
  notificationId?: string
  emailStatus: "skipped" | "sent" | "failed"
  error?: string
  readAt?: string
}

// --- Password reset requests ---
export interface PasswordResetRequestItem {
  id: string
  userId?: string
  email: string
  message: string
  status: "pending" | "resolved" | "rejected"
  handledBy?: string
  handledAt?: string
  adminNote: string
  createdAt: string
}
