# ShiftSync — Project Context for Claude

## Tech Stack
- **Monorepo:** pnpm workspaces (NOT npm, NOT yarn)
- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS — `frontend/` (port 5173)
- **Backend:** Express + TypeScript + Drizzle ORM — `backend/` (port 3001)
- **DB:** PostgreSQL via Supabase
- **Auth:** Google OAuth + JWT (no password auth, no email-only login)
- **Deploy:** Vercel (frontend + backend as separate projects) + Supabase

## Key Commands
```bash
pnpm dev              # run frontend + backend concurrently from root
pnpm --filter backend db:migrate   # run drizzle migrations
pnpm --filter backend db:seed      # seed DB with relative-date test data
pnpm --filter backend test         # backend tests
pnpm --filter frontend test        # frontend tests
```

## Domain Model & Architecture Decisions

These decisions are **final** — do not revisit without explicit user instruction:

- **`shift_users(shift_id, user_id, state)`** — ONE explicit state per user per shift. States: `'in_shift' | 'available' | 'home'`. No implicit "missing row = available" pattern; every assigned user has an explicit row.
- **`home_request_shifts`** — flat table, no parent `home_requests` table. Grouped by `request_id` UUID. Fields: `id, request_id uuid, user_id, schedule_id, shift_id, decision`.
- **Approved home request** → directly updates `shift_users.state = 'home'` (not a separate state tracker).
- **`primary_team_id` on schedules** is immutable after creation — enforced server-side, never allow updates to it.
- **Fill-in user** = `user.team_id IS NULL OR user.team_id != schedule.primary_team_id`
- **Seed data** always uses dates relative to today (never hardcoded dates).
- **Dev login bypass** is guarded by `process.env.NODE_ENV === 'development'` (explicit opt-in, not `!== 'production'`).
- **Docker Postgres** runs on port **5434** locally (5432 and 5433 were already in use).

## Key Files
- `backend/src/db/schema.ts` — Drizzle schema (all 8 tables)
- `backend/src/routes/` — All API routes
- `backend/src/db/seed.ts` — Idempotent seed data
- `frontend/src/components/ScheduleGrid.tsx` — Main schedule grid (sticky cols, bulk edit, admin controls)
- `frontend/src/pages/admin/ScheduleDetail.tsx` — Admin schedule management + auto-fill

## ScheduleGrid Layout Rules
- The grid uses fixed-height reserved space for the "bulk edit" action bar — **never let it push layout when it appears/disappears**
- Column header checkboxes must not change column widths on toggle (use fixed widths)
- Bulk select mode is triggered by clicking a user name/row header, not a separate button
- Sticky first column + sticky header row; horizontal scroll for shifts

## Admin Routing
- Admin users must be routed to `/admin/schedules/:id` (editable view), not `/schedules/:id` (read-only user view)
- The Requests page admin view shows **all** requests system-wide, not filtered to the admin's own user ID

## Internationalization (i18n)
- The app supports English and Hebrew. Hebrew is RTL; the `<html dir>` attribute is set automatically on language change.
- **All new UI strings must have entries in both `frontend/src/locales/en.json` and `frontend/src/locales/he.json`.**
- Use `useTranslation` / `t()` from `react-i18next` — never hardcode English strings in components.
- The schedule grid is forced `dir="ltr"` regardless of language (sticky columns depend on it).

## Packages & Dependencies
When adding new packages, use `pnpm add` (not npm/yarn). Do not add packages that are already available from existing dependencies.

## Automatic Reminders (Claude must enforce these)

**After editing `backend/src/db/schema.ts`:** Always remind the user to run:
```bash
pnpm --filter backend db:migrate
```
Schema changes are not live until migrated. Do not skip this reminder.

**Before staging or committing any file:** Warn loudly if `.env`, `.env.local`, `.env.production`, or any file matching `*.env*` is about to be committed. These must never be committed. Verify `.gitignore` covers them.
