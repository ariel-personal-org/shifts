# ShiftSync

Full-stack shift scheduling app. Teams, schedules, home requests, auto-fill, audit logs.

**Stack**: React + Vite (frontend) · Express + Drizzle ORM (backend) · PostgreSQL via Supabase · Google OAuth

---

## Quick Start

### 1. Clone & Install

```bash
npm install
```

### 2. Set up Supabase (database)

1. Go to [supabase.com](https://supabase.com) → New Project
2. After it's ready: **Settings → Database → Connection string → URI**
3. Copy the connection string (replace `[YOUR-PASSWORD]` with your DB password)

### 3. Set up Google OAuth

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → **APIs & Services → Credentials → Create OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Authorized JavaScript origins:
   - `http://localhost:5173` (dev)
   - `https://your-app.vercel.app` (prod)
5. Copy the **Client ID**

### 4. Configure environment

**Backend** — copy `backend/.env.example` to `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

Fill in:
```
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
JWT_SECRET=any-random-32-char-string
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
ADMIN_EMAILS=your@gmail.com
FRONTEND_URL=http://localhost:5173
```

**Frontend** — copy `frontend/.env.example` to `frontend/.env`:

```bash
cp frontend/.env.example frontend/.env.local
```

Fill in:
```
VITE_API_URL=http://localhost:3001
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

### 5. Run migrations & seed

```bash
npm run db:migrate   # creates tables in Supabase
npm run db:seed      # inserts demo data
```

### 6. Start dev servers

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

### 7. Log in

Sign in with your Google account. If your email is in `ADMIN_EMAILS`, you'll automatically get admin access.

Demo data users (sign in with Google using matching emails, or set `ADMIN_EMAILS`):
- `alice@example.com` — admin, Alpha Team
- `bob@example.com` — Alpha Team
- `carol@example.com` — Alpha Team
- `dave@example.com` — Beta Team (fill-in)
- `eva@example.com` — Beta Team

---

## Deployment

### Vercel + Supabase

**Backend:**
```bash
cd backend
vercel
```
Set env vars in Vercel dashboard: `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `ADMIN_EMAILS`, `FRONTEND_URL`

**Frontend:**
```bash
cd frontend
vercel
```
Set env vars: `VITE_API_URL` (your backend Vercel URL), `VITE_GOOGLE_CLIENT_ID`

After deploying frontend, update `FRONTEND_URL` in backend env vars and add the Vercel URL to Google OAuth authorized origins.

---

## Features

**User**
- Google SSO login (no passwords)
- Read-only schedule grid view
- Submit home requests for specific shifts or date ranges
- View own request status (pending / partial / approved / rejected)
- In-app notifications with unread badge count
- Personal audit history

**Admin (includes all user features)**
- Create / edit schedules (primary team is immutable after creation)
- Add/remove members to schedules
- Edit any user's shift state (in shift / available / home)
- Approve / reject home requests per-shift (partial approvals supported)
- Auto-fill: greedy algorithm fills under-capacity shifts from available members
- Manage teams and team membership
- Manage users: set team, toggle admin
- Global audit log with filters

---

## Data Model

```
teams          → id, name
users          → id, name, email, is_admin, team_id
schedules      → id, name, dates, cycle_start_time, shift_duration_hours, capacity, primary_team_id
shifts         → id, schedule_id, start_datetime, end_datetime, index
schedule_members → (schedule_id, user_id)
shift_users    → (shift_id, user_id, state: in_shift|available|home)
home_request_shifts → id, request_id(uuid), user_id, schedule_id, shift_id, decision
notifications  → id, user_id, type, payload_json, is_read
audit_logs     → id, actor_user_id, affected_user_id, schedule_id, shift_id, action, old/new json
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start both backend and frontend |
| `npm run db:migrate` | Run Drizzle migrations |
| `npm run db:seed` | Insert demo data (idempotent) |
| `npm run db:reset` | Drop and recreate schema (⚠ destructive) |
| `npm run build` | Build both packages |
