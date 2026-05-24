# CutOff CRM

Next.js CRM for customer interactions, AI insights, and follow-up work linked into the shared Ops task model.

## Stack

- Next.js App Router
- Supabase Auth client compatibility at the app boundary
- Shared PostgreSQL tables for CRM data
- Native route handlers under `app/api`

## Setup

1. Install dependencies

```bash
npm install
```

2. Add environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
OPS_DEFAULT_OPERATION_ID=...
OPS_DEFAULT_WORKFLOW_ID=...
OPS_DEFAULT_STATUS_ID=...
```

3. Apply the shared CRM schema in [supabase/schema.sql](./supabase/schema.sql) after the Ops schema exists.

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
- If no CRM role exists, Ops admins are treated as CRM admins and other users default to `staff`.
- Follow-up tasks are created in the Ops `tasks` table through `shared/ops-tasks.js`.
- Authenticated accounts must map to a shared `users` row before writing staff-owned CRM records.
