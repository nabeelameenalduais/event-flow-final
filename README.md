# EventFlow

EventFlow is a full event-management platform built with React, TypeScript and Supabase. It covers the whole event lifecycle: discovering and registering for events, issuing tickets, checking attendees in, managing sessions and costs, collecting evaluations, running event chat, and administering users and system settings.

## Features

### Attendees
- Browse published public events and view event details.
- Register for events, join waitlists when capacity is reached, and cancel registrations.
- Receive a QR ticket and view it from the dashboard.
- Chat with organizers through general and private channels.
- Submit feedback and evaluations for events they attended.

### Organizers
- Create, edit, publish, archive, duplicate and delete events.
- Manage registrations, waitlists and invitations.
- Scan tickets and track attendance (check-in / check-out).
- Build schedules with sessions and speakers.
- Track planned vs. actual event costs.
- Create evaluations and review feedback.
- Send event reminders to confirmed attendees.
- Access event chat and private attendee conversations.

### Administrators
- Manage users, roles and account suspension.
- Manage categories, venues and uploaded files.
- View reports and dashboard statistics.
- Configure system settings: application name, timezone, date format, branding (logo, favicon, primary color) and email templates.
- Review the audit log and security centre.

## Tech Stack

| Layer | Technology |
| --- | --- |
| UI | React 19, TypeScript, Vite 8 |
| Styling | Tailwind CSS 4, Radix UI primitives, lucide-react |
| Routing | React Router 7 |
| Backend | Supabase (Postgres, REST, Realtime) |
| Charts | Recharts |
| QR codes | qrcode, html5-qrcode |
| Testing | Vitest, Testing Library |
| Linting | Oxlint |

## Getting Started

### Prerequisites
- Node.js 20+ and npm
- A Supabase project

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and set your Supabase project URL and anon key:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 3. Set up the database

Run the SQL files in `supabase/` against your Supabase project, in order:

1. `supabase/schema.sql` — tables, types, indexes, RPC functions and triggers.
2. `supabase/schema-part2-security.sql` — row-level security policies and column grants.

You can paste them into the Supabase SQL editor, or apply them with the Supabase CLI:

```bash
supabase db push
```

The schema includes server-side authentication functions (`authenticate_user`, `register_user`, `get_session_user`, password reset), waitlist promotion, automatic organizer assignment, notifications and audit logging.

### 4. Run the app

```bash
npm run dev
```

The dev server runs at `http://localhost:5173`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) and build for production |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run Oxlint |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |

## Project Structure

```text
src/
  components/       Reusable UI, layout and chat components
  contexts/         Auth, theme and app-settings providers
  lib/              Supabase client, helpers and hooks
  pages/            Route-level pages (dashboard, events, admin, ...)
  routes/           Route definitions and guards
  services/         Data access layer (Supabase queries and RPCs)
  test/             Test setup
  types/            Shared TypeScript types
  constants.ts      Domain constants (statuses, roles, notification types)
supabase/
  schema.sql        Database schema, functions and triggers
  schema-part2-security.sql  RLS policies and grants
```

## Authentication and Roles

Authentication is implemented with Supabase RPC functions and a custom session token stored in `localStorage` (`eventflow_session`). Passwords are verified server-side; new accounts use bcrypt and legacy SHA-256 hashes remain supported.

Three roles are available:

- **attendee** — browse, register, receive tickets, chat, submit evaluations.
- **organizer** — manage their own and assigned events, plus all organizer tools.
- **admin** — full access, including user management, settings and reports.

> `events.organizer_id` references `profiles.id`, while `event_organizers.user_id`, `chat_channels.organizer_id` and notification recipients use `users.id`. Keep this distinction in mind when extending the data layer.

## Deployment

1. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your hosting provider.
2. Run `npm run build`.
3. Deploy the `dist/` directory to any static host (Vercel, Netlify, Cloudflare Pages, etc.). Configure a SPA fallback so unknown paths resolve to `index.html`.

## License

This project was built for academic purposes. Add a license here if you plan to distribute it.
