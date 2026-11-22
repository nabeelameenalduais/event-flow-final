# EventFlow — UML Documentation

This directory contains 7 Mermaid diagrams that document the EventFlow system
design: actors and functionality, the domain model, the database schema, the
authentication flow, the state machines, the QR check-in workflow, and the runtime
architecture. Every diagram is consistent with the system implementation
(`src/types`, `src/services`, and `supabase/schema.sql`).

Rendering: these `.mmd` files can be rendered by any Mermaid-compatible viewer
(https://mermaid.live, VS Code Markdown Preview Mermaid Support, etc.).

> **Note on the Use Case diagram:** Mermaid has no native `usecase` diagram type in
> any released version (feature PRs mermaid-js/mermaid#7519/#7530 are still open).
> `01_use_case.mmd` therefore uses the `flowchart` diagram type: actors are rounded
> nodes outside the system boundary (a `subgraph`), use cases are nodes inside it.
> The generalization relation is drawn as a dashed edge labeled `generalization`.
> No semantics are changed.

---

## Diagram list

| File | Diagram type | Subject |
|---|---|---|
| `01_use_case.mmd` | Use Case (flowchart-based) | Actors, public/attendee/organizer/admin functionality |
| `02_class.mmd` | Class | Domain classes, multiplicities, service modules |
| `03_erd.mmd` | ERD (`erDiagram`) | All 30 database tables and their FK relationships |
| `04_sequence_auth.mmd` | Sequence | Custom authentication (login, session restore, logout, register) |
| `05_state_machine.mmd` | State | Event / Registration / Ticket state machines |
| `06_activity_checkin.mmd` | Activity | QR ticket check-in workflow |
| `07_component.mmd` | Component | Frontend / Supabase / AI chatbot architecture |

---

## 1. Use Case — `01_use_case.mmd`

**Purpose:** identify the actors of the system and the functionality each one can perform.

**Actors** (from the roles enum, `src/constants.ts:27`, `src/types/index.ts:1`):
- **Visitor** — unauthenticated user (public pages, `src/routes/index.tsx:46-55`).
- **Attendee** — role `attendee`.
- **Organizer** — role `organizer`.
- **Admin** — role `admin`. Admin includes organizer privileges because all
  organizer routes allow both `["organizer", "admin"]` (`src/routes/index.tsx:75-85`),
  plus admin-only routes (`:67-74`).

**Use cases and their evidence:**

| Use case | Evidence |
|---|---|
| Browse published events, View event detail | Public routes `/events`, `/events/:id` (`src/routes/index.tsx:47-48`) |
| Register account, Log in, Reset password | `/register`, `/login`, `/forgot-password`, `/reset-password` (`:52-55`); `authService.register`/`login`/`requestPasswordReset` (`authService.ts:279,256,331`) |
| Register for an event (auto ticket / waitlist) | `EventDetail.tsx:109` calls `registerForEvent` which returns `{ registration, waitlisted }` (`eventService.ts:236`) |
| View / download ticket (QR code) | `TicketDetail.tsx:33` `getTicketForOwner`, `:57` `downloadTicket` |
| Submit event evaluation | `/events/:id/evaluate` (attendee only, `routes:49`); `evaluationService.submitEvaluation` |
| Submit feedback | `EventDetail.tsx:141` `submitFeedback` (confirmed attendee, `:159`) |
| Participate in event chat | `/events/:eventId/chat` roles `["organizer","admin","attendee"]` (`routes:86`); `chatService` |
| Cancel own registration | `Dashboard.tsx:144`, `EventDetail.tsx:127` `cancelRegistration` |
| Create / edit / delete event | `EventForm`, `/dashboard/events/*` (`routes:77-78`); `eventService.createEvent/updateEvent/deleteEvent` |
| Publish / archive / set draft | `EventManagement.tsx:117-128`; `eventService.ts:184-194` |
| Manage schedule (sessions & speakers) | `/dashboard/events/:eventId/schedule` (`routes:79`); `eventService.getSessions/getSpeakers` |
| Manage registrations | `/dashboard/events/:eventId/registrations` (`routes:80`); `RegistrationManagement.tsx:58` `cancelRegistration` |
| QR check-in / check-out | `/dashboard/events/:eventId/attendance` (`routes:81`); `attendanceService.checkIn/checkOut` |
| Generate & share invitation links | `/dashboard/events/:eventId/invitations` (`routes:82`); `InvitationManagement.tsx` |
| Manage event costs | `/dashboard/events/:eventId/costs` (`routes:83`); `costService` |
| Build & manage evaluations | `/dashboard/events/:eventId/evaluation` (`routes:84`); `evaluationService` |
| Respond to feedback | `/dashboard/feedback` (`routes:75`); `feedbackService.respondToFeedback` |
| Manage users / categories / venues / files | `/dashboard/admin/*` admin-only (`routes:67-71`) |
| Manage event organizers | `/dashboard/events/:eventId/organizers` admin-only (`routes:85`) |
| View reports / settings / security | `/dashboard/admin/reports|settings|security` admin-only (`routes:72-74`) |

---

## 2. Class Diagram — `02_class.mmd`

**Purpose:** show the domain classes (`src/types/index.ts`) and the relationships
between them, with multiplicities consistent with the database constraints
(`supabase/schema.sql`), and the service layer as function modules.

### Relationship evidence

Every relationship in the class diagram is supported by an FK or UNIQUE constraint
defined in the database schema (`supabase/schema.sql`). The authoritative
mapping:

| Association | Cardinality | Constraint evidence |
|---|---|---|
| `User` — `Profile` | **1:1** | `profiles_user_id_key UNIQUE(user_id)` + `profiles_user_id_fkey FK(user_id) → users(id) ON DELETE CASCADE` |
| `Role` — `Profile` | 1:N | `profiles_role_id_fkey FK(role_id) → roles(id)` (no UNIQUE) |
| `Category` — `Event` | 1:N | `events_category_id_fkey FK(category_id) → categories(id)` |
| `Venue` — `Event` | 1:N | `events_venue_id_fkey FK(venue_id) → venues(id)` |
| `Profile` — `Event` (organizer) | 1:N | `events_organizer_id_fkey FK(organizer_id) → profiles(id)` |
| `User` — `Event` (meeting link) | 1:N | `events_meeting_link_generated_by_fkey FK → users(id) ON DELETE SET NULL` (nullable) |
| `Event` — `User` | **M:N** | join table `event_organizers`, `event_organizers_event_user_unique UNIQUE(event_id, user_id)` |
| `Event` — `Session` | 1:N | `sessions_event_id_fkey FK(event_id) → events(id) ON DELETE CASCADE` |
| `Session` — `Speaker` | 1:N | `speakers_session_id_fkey FK(session_id) → sessions(id) ON DELETE CASCADE` |
| `Event` — `Registration` | 1:N | `registrations_event_id_fkey FK(event_id) → events(id) ON DELETE CASCADE` |
| `Profile` — `Registration` | 1:N | `registrations_attendee_id_fkey FK(attendee_id) → profiles(id)` |
| `Registration` — `Ticket` | **1:1** | `tickets_registration_id_key UNIQUE(registration_id)` + FK |
| `Ticket` — `Attendance` | **1:0..1 (app-enforced)** | `attendance_ticket_id_fkey FK(ticket_id) → tickets(id)`; the application allows at most one attendance row per ticket (`maybeSingle`, `attendanceService.ts:98`) and `checkIn` inserts only when absent. |
| `Event` — `InvitationLink` | 1:N | `invitation_links_event_id_fkey FK(event_id) → events(id) ON DELETE CASCADE` |
| `Event` — `ChatChannel` | 1:N | `chat_channels_event_id_fkey FK(event_id) → events(id) ON DELETE CASCADE` |
| `User` — `ChatChannel.organizerId` | 1:N | `chat_channels_organizer_id_fkey FK(organizer_id) → users(id) ON DELETE CASCADE` (nullable) |
| `Profile` — `ChatChannel.attendeeId` | 1:N | `chat_channels_attendee_id_fkey FK(attendee_id) → profiles(id) ON DELETE CASCADE` (nullable) |
| `ChatChannel` — `ChatMessage` | 1:N | `chat_messages_channel_id_fkey FK(channel_id) → chat_channels(id) ON DELETE CASCADE` |
| `User` — `ChatMessage.senderId` | 1:N | `chat_messages_sender_id_fkey FK(sender_id) → users(id) ON DELETE CASCADE` |
| `ChatMessage` — `ChatMessageWithSender` | inheritance (application) | **Application-only** derived type (`types/index.ts:228`), not a table — labeled as such. |
| `Event` — `Feedback` | 1:N | `feedback_event_id_fkey FK(event_id) → events(id) ON DELETE CASCADE` |
| `Profile` — `Feedback` | 1:N | `feedback_attendee_id_fkey FK(attendee_id) → profiles(id)` |
| `Event` — `Evaluation` | **1:0..1 (app-enforced)** | `evaluations_event_id_fkey`; the application allows at most one evaluation per event (`evaluationService.createEvaluation`, `getEvaluationByEvent` with `maybeSingle`). |
| `User` — `Evaluation.createdBy` | 1:N | `evaluations_created_by_fkey FK(created_by) → users(id) ON DELETE SET NULL` (nullable) |
| `Evaluation` — `EvaluationQuestion` | 1:N | `evaluation_questions_evaluation_id_fkey FK → evaluations(id) ON DELETE CASCADE` |
| `Evaluation` — `EvaluationSubmission` | 1:N | `evaluation_submissions_evaluation_id_fkey FK → evaluations(id) ON DELETE CASCADE` |
| `Profile` — `EvaluationSubmission` | 1:N | `evaluation_submissions_attendee_id_fkey FK(attendee_id) → profiles(id)`; plus `evaluation_submissions_unique UNIQUE(evaluation_id, attendee_id)` |
| `EvaluationSubmission` — `EvaluationAnswer` | 1:N | `evaluation_answers_submission_id_fkey FK → evaluation_submissions(id) ON DELETE CASCADE` |
| `EvaluationQuestion` — `EvaluationAnswer` | 1:N | `evaluation_answers_question_id_fkey FK → evaluation_questions(id) ON DELETE CASCADE` |
| `Event` — `EventCost` | 1:N | `event_costs_event_id_fkey FK(event_id) → events(id) ON DELETE CASCADE` |
| `User` — `EventCost.createdBy/updatedBy` | 1:N | `event_costs_created_by_fkey` / `event_costs_updated_by_fkey FK → users(id) ON DELETE SET NULL` (nullable) |
| `User` — `Notification` | 1:N | `notifications_user_id_fkey FK(user_id) → users(id) ON DELETE CASCADE` |
| `Profile` — `FileItem` | 1:N | `files_uploaded_by_fkey FK(uploaded_by) → profiles(id)` |
| `User` — `AuditLog` | 1:N | `audit_logs_user_id_fkey FK(user_id) → users(id)` |
| `User` — `DeviceSession` | 1:N | `device_sessions_user_id_fkey FK(user_id) → users(id) ON DELETE CASCADE` |

**Modelling rules:**
- No relationship is inferred from naming or business assumptions; every
  multiplicity cites an FK or UNIQUE constraint above.
- A TypeScript type is only treated as a database table when the relationship is
  actually represented in the database. All domain types map 1:1 to real tables.
- Application-level relationships (e.g. `ChatMessageWithSender extends ChatMessage`)
  are labeled as application-only.
- Only the operational state transitions are modeled in the state machine diagram
  (see section 5); no transitions are invented for states outside the operational
  flow.

### Service modules

`authService`, `eventService`, `attendanceService`, `ticketService`,
`invitationService`, `evaluationService`, `chatService`, `costService`,
`notificationService`, `userService`, `venueService`, `categoryService`,
`feedbackService`, `auditService`, `deviceSessionService`, `fileService`,
`reportsService`, `settingsService`, `organizerService`, `dashboardService` are
shown as `<<module>>` nodes. Only exported functions defined in the source are
listed (see `src/services/*`). They are **not** part of the DB relation graph.

---

## 3. ERD — `03_erd.mmd`

**Purpose:** the authoritative entity-relationship model of the EventFlow database.

**Source of truth:** `supabase/schema.sql` — the authoritative database schema
definition of the system. All 30 `public` tables are included.

- All relationships are real FK constraints (list in the previous section; ERD
  labels name the constraint column).
- 1:1 relationships: `profiles.user_id` (UNIQUE), `tickets.registration_id` (UNIQUE),
  `tickets.unique_code` (UNIQUE), `invitation_links.code` (UNIQUE), `roles.name` (UNIQUE).
- Composite UNIQUEs: `event_organizers(event_id, user_id)`,
  `evaluation_submissions(evaluation_id, attendee_id)`,
  `evaluation_answers(submission_id, question_id)`.
- `app_settings` and `email_templates` are separate tables (no FK between them).
  Note: the TS `AppSettings` type embeds `emailTemplates: EmailTemplate[]`
  (`types/index.ts:194`) at the **application** level only — the DB keeps them in a
  separate table.
- `auth_attempts` has no FK relationships; `password_reset_tokens.user_id` →
  `users.id`.
- **Security design:** `auth_attempts` is a rate-limit bookkeeping table. Client
  grants on it are fully revoked (`schema-part2-security.sql`), so only the
  SECURITY DEFINER RPCs can access it and clients receive 401. Password hashes and
  session tokens are likewise never readable by clients.

---

## 4. Authentication Sequence — `04_sequence_auth.mmd`

**Purpose:** show how the custom authentication works end-to-end.

**Key facts:**
- **Custom auth, NOT Supabase Auth.** Credentials checked against `public.users`
  (`password_hash`) via SECURITY DEFINER RPCs. See `authService.ts`, `supabase/schema.sql`.
- **Login:** `AuthContext.login` → `authService.login` (rate-limited by
  `withRateLimit("login:<email>", 30/60s)`, `rateLimit.ts`) → RPC
  `authenticate_user` (`schema.sql:195`). Server verifies: ≤5 attempts / 15 min
  (`auth_attempts`), user exists, password (bcrypt `crypt()` or SHA-256
  digest), account not suspended, then clears `auth_attempts` and returns
  `{user, profile, role}` — the password hash is **never** returned.
- **Auth path:** authentication always goes through the `authenticate_user` RPC
  (SECURITY DEFINER). The client can never read `password_hash` (grants revoked).
- **Session token:** generated client-side by `generateSessionToken()`
  (`crypto.randomUUID()`), stored in `device_sessions.token` and in
  `localStorage["eventflow_session"]` (`AuthContext.tsx:6`). The token is **never**
  re-read from the DB by the client.
- **Restore:** on app boot `AuthProvider` reads the token and calls RPC
  `get_session_user` (`schema.sql:388`) which updates `last_active_at` and returns
  the user/profile/role. On failure the token is removed (`AuthContext.tsx:49`).
- **Logout:** RPC `revoke_session` (`schema.sql:448`) deletes the
  `device_sessions` row; the client also clears `localStorage`.
- **Register:** RPC `register_user` (`schema.sql:337`) rejects duplicate emails,
  hashes with bcrypt (`gen_salt('bf',10)`), inserts `users` + `profiles`
  (role = attendee) in one transaction; a device session is created like login.

---

## 5. State Machine — `05_state_machine.mmd`

**Purpose:** the lifecycle of `Event`, `Registration`, and `Ticket`.

**Event** (`types/index.ts:47`): `draft | published | archived`, default `draft`.
Transitions (UI in `EventManagement.tsx:117-128`):
- `draft → published` — `publishEvent` (`eventService.ts:184`, button "Publish")
- `published → draft` — `setDraft` (`:192`, button "Unpublish")
- `published → archived` — `archiveEvent` (`:188`, button "Archive")
- `archived → published` — `publishEvent` (button "Republish")
- Creation: `createEvent` (draft) and `duplicateEvent` (also draft,
  `EventManagement.tsx:49`).
- There is **no** UI path `archived → draft`; `setDraft` exists in the service but
  is only wired from the `published` state.

**Registration** (`types/index.ts:130`): `pending | confirmed | cancelled | waitlisted`.
- `registerForEvent` sets `confirmed` when capacity is not full, `waitlisted`
  otherwise (`eventService.ts:284`). Ticket generated only when confirmed (`:293-295`).
- `cancelRegistration` sets `cancelled`; if a confirmed spot was freed, the oldest
  `waitlisted` registration is promoted to `confirmed` and a ticket is generated
  (`eventService.ts:379-421`).

**Ticket** (`types/index.ts:140`): `valid | used | invalid`.
- `valid → used` — `checkIn` (`attendanceService.ts:40`) and `markAutoAttendance`
  (`:153`).

---

## 6. QR Check-in Activity — `06_activity_checkin.mmd`

**Purpose:** the organizer's QR/manual ticket check-in workflow.

**Flow:**
1. `AttendanceManagement` loads the event; access guard redirects unless
   `event.organizerId === profile.id` or role is `admin` (`AttendanceManagement.tsx:48`).
2. Organizer either types the ticket code or opens `QrScanner`
   (`html5-qrcode`, camera `facingMode: environment`, `QrScanner.tsx:29-39`);
   camera failure falls back to manual code entry (`QrScanner.tsx:43-46`).
3. `lookupTicket` → `findTicketByCode` (`attendanceService.ts:103`) which returns
   a ticket only if its registration is `confirmed`.
4. Existing attendance is loaded (`getAttendanceByTicket`, `:93`) to decide the
   dialog: **Check In** (no record), **Check Out** (record without `check_out_time`),
   or **already processed** (`AttendanceManagement.tsx:201-256`).
5. `checkIn` (`attendanceService.ts:24`): rejects `used` tickets and
   non-`confirmed` registrations; updates ticket to `used`, inserts an `attendance`
   row with `check_in_time`.
6. `checkOut` (`:52`): sets `check_out_time` on the existing attendance row.
7. Direct per-row Check In / Check Out buttons are available in the table
   (`AttendanceManagement.tsx:300-309`).

---

## 7. Component / Architecture — `07_component.mmd`

**Purpose:** runtime topology of the EventFlow application.

**Architecture facts:**
- **Entry / providers:** `main.tsx` renders `ThemeProvider → AuthProvider →
  RouterProvider`. `App.tsx` renders `<Outlet/>` plus the global `ChatWidget`
  (`App.tsx:4-10`).
- **Routing:** `createBrowserRouter` with `PublicLayout` (public pages) and
  `AppLayout` wrapped in `ProtectedRoute`; admin/organizer/attendee gating via
  `ProtectedRoute roles={[...]}` (`src/routes/index.tsx`).
- **Data layer:** every page calls service modules (`src/services/*`) which talk
  to Supabase through `lib/supabase.ts` (`createClient(URL, anonKey)`). Custom auth
  uses RPCs; the rest of the data model uses REST via the anon key.
- **AI assistant — local development:** `ChatWidget` → `useChat` posts to
  `/lmstudio/v1/chat/completions` (`useChat.ts:3`), proxied by Vite to
  `http://127.0.0.1:1234` (`vite.config.ts:10-16`). Tool calls are executed by
  `useChat.executeTool` via direct Supabase REST fetches (`useChat.ts:83-231`).
- **AI assistant — production deployment:** a Supabase Edge Function
  `supabase/functions/chatbot/index.ts` provides the OpenRouter integration
  (`meta-llama/llama-3.2-3b-instruct:free`) as the deployment option for the
  assistant backend (shown dashed in `07_component.mmd`).

---

## Design notes

- **Chatbot backends.** The assistant offers two integration options: a local LM
  Studio endpoint through the Vite dev proxy (used by the UI during development)
  and a deployable Supabase Edge Function targeting OpenRouter
  (`supabase/functions/chatbot`). Both are shown in `07_component.mmd`.
- **Notification types.** Notification types are stored as text and validated in
  the application layer (`types/index.ts:158`, `constants.ts:33-43`), which keeps
  the schema flexible and avoids migrations when new types are added.
- **Cardinality enforcement.** Attendance is at most one row per ticket and an
  event has at most one evaluation; both are enforced by the application layer
  before insert (`attendanceService.ts:98`, `evaluationService`), in addition to
  the database FK constraints.

## How to use

- Use the `.mmd` files directly in a Mermaid renderer (GitHub, mermaid.live, VS Code).
- `UML_DOCUMENTATION.md` provides the evidence for every element with exact
  `file:line` references.
- Keep the diagrams in sync with the system design; update them together with any
  change to the domain model or the database schema.
