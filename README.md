# Vector Control

Internal CRM and Business Management System for **Vector Codes** (founder: Prince Eric).

Private, production-oriented platform for managing prospects, outreach, deals, client projects,
payments, expenses, rejections, follow-ups, tasks, staff and business performance.

## Stack

- Next.js (App Router) + TypeScript + React
- Tailwind CSS v4 + shadcn-style UI primitives + Lucide icons
- Supabase (PostgreSQL, Auth, SSR, Row Level Security)
- Recharts analytics · Zod validation
- Vercel deployment

## Environment variables

| Variable | Visibility | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Publishable key — safe in the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only secret** | Staff invitations and founder-only profile administration. Never expose in browser code, never commit. |
| `NEXT_PUBLIC_APP_URL` | Public | Base URL used for password-reset redirects |

Copy `.env.example` to `.env.local` for local development. `.env.local` is git-ignored.
On Vercel, set the same variables in Project Settings → Environment Variables.

## Supabase setup

Supabase project: `qbmvpmtcelztuzxyifcp` (Vector Control).

1. Run migrations in order in the Supabase SQL editor (or Supabase CLI):
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/migrations/0003_founder_provisioning.sql`
   - `supabase/migrations/0004_security_alignment.sql` ← **required for the repair**
     (revokes anonymous read access to the financial views, adds an authenticated
     audit-insert policy, and removes table-level DELETE grants so the app's
     soft-delete workflow is the only path).
2. The live schema is the source of truth: profiles, prospects, outreach_activities,
   deals, rejections, projects, payments, expenses, tasks, audit_logs, company_settings,
   plus the `financial_overview` and `deal_financial_summary` views.

## Authentication

- Login / logout / password reset via Supabase Auth; sessions refresh in middleware.
- New accounts default to **inactive staff**. They see an "Account not activated" page
  until the founder activates them. There is **no founder auto-claim** — the founder
  account is assigned its role explicitly (e.g. set your own account's role to
  `founder` once in the `profiles` table from the Supabase dashboard, then manage
  everyone else from the Staff page).
- Only the founder can invite, activate, deactivate or change staff roles. These
  privileged operations run server-side through the service-role client after the
  caller's founder status is verified.
- Inactive authenticated users are never trapped in a redirect loop: they get a clear
  access-restricted page with a sign-out option.

## Financial rules (enforced in code)

1. A won deal is **not** revenue.
2. Revenue = successful `payment` transactions minus successful `refund` transactions.
3. Pending and failed payments never count as revenue.
4. Expenses are tracked separately; Net operating result = net revenue − expenses.
5. Outstanding balance = won deal value − net successful payments for that deal (min 0).
6. Headline figures come from the `financial_overview` view; all amounts are NGN.

## Soft-delete policy

The live database does not grant DELETE to ordinary users. Prospects are archived
(status → disqualified), deals/projects/tasks are cancelled via status changes, and
rejection records are never deleted. This preserves complete business history.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm run build
```

## Deployment (Vercel)

1. Import the repository into Vercel.
2. Add all environment variables from the table above (include `SUPABASE_SERVICE_ROLE_KEY`).
3. Set `NEXT_PUBLIC_APP_URL` to the production URL.
4. Deploy. Never commit `.env.local`.

## Known limitations

- End-to-end runtime testing (login, CRUD flows, role restrictions) has not been
  executed in a live environment yet — see the delivery notes. Run the manual test
  checklist before declaring production readiness.
