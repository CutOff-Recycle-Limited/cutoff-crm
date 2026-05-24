# CutOff CRM

Next.js CRM for customer interactions, AI insights, and follow-up work linked into the shared Ops task model.

## Stack

- Next.js App Router
- Supabase Auth client compatibility at the app boundary
- Neon/Postgres via `DATABASE_URL` for CRM application data
- Native route handlers under `app/api`

## Setup

1. Install dependencies

```bash
npm install
```

2. Add Vercel environment variables

```bash
DATABASE_URL=...
NEXT_PUBLIC_AUTH_SUPABASE_URL=...
NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY=...
OPS_DEFAULT_OPERATION_ID=...
OPS_DEFAULT_WORKFLOW_ID=...
OPS_DEFAULT_STATUS_ID=...
```

Supabase is currently used for authentication/session handling only. Neon/Postgres is the application database for `customers`, `interactions`, `ai_insights`, and CRM-linked Ops `tasks`. Do not create CRM data tables in Supabase.

`SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_JWT_SECRET` are not read by the CRM code.

3. Apply the shared Neon/Postgres schema after the Ops schema exists.

4. Start the app

```bash
npm run dev
```

## Routes

- `/interactions/new` interaction logging
- `/interactions` interactions list with AI insight summaries
- `/tasks` CRM-linked Ops task management
- `/admin` admin dashboard
- `/sign-in` auth entry

## API

- `POST /api/interactions`
- `GET /api/interactions`
- `GET /api/customers`
- `GET /api/admin/dashboard`
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`

`/api/calls` remains as a compatibility wrapper around `interactions` with `channel = 'call'`.

## Notes

- CRM role is read from `user_platform_roles` with `platform = 'crm'`.
- If no CRM role exists, the user defaults to `staff`; admin routes require a CRM role of `admin`.
- Follow-up tasks are created in the Ops `tasks` table through `shared/ops-tasks.js`.
- Authenticated accounts must map to a shared `users` row before writing staff-owned CRM records.
