# Vector Control

Internal CRM and Business Management System for **Vector Codes** (founder: Prince Eric).

Private, production-oriented platform for managing prospects, outreach, deals, client projects,
payments, expenses, rejections, follow-ups, tasks, staff and business performance.

## Stack

- Next.js (App Router) + TypeScript + React
- Tailwind CSS v4 + shadcn-style UI primitives + Lucide icons
- Supabase (PostgreSQL, Auth, SSR, Row Level Security)
- Recharts analytics
- Vercel deployment

## Modules

Overview · Prospects · Outreach · Deals · Projects · Finance · Rejections · Tasks · Reports · Staff · Settings

All amounts are in **Nigerian Naira (NGN)**. Revenue is counted **only from successful payments**
(a won deal is not revenue). Net operating result = recognised payments − recognised expenses.

## Setup

1. Create a Supabase project.
2. Run the SQL migrations in `supabase/migrations` in order (SQL Editor or Supabase CLI).
3. Copy `.env.example` to `.env.local` and fill in the Supabase URL and keys.
4. `npm install && npm run dev`.
5. Sign up with the founder email listed in `FOUNDER_EMAILS` — the first account that signs up
   (or an email on the allow-list) is automatically provisioned as **Founder**.

## Deployment (Vercel)

- Import the repository into Vercel.
- Add the environment variables from `.env.example` in Project Settings.
- Deploy. Never commit `.env.local`.

## Security

- RLS is enabled on every business table; policies are role-aware (founder / admin / staff).
- Roles are resolved server-side from `profiles`, never from client input.
- All mutations are validated with Zod and run as authenticated server actions.
- Sensitive operations are recorded in `audit_logs`.

## Status

Phases 1–6 implemented (structure, design system, auth/RLS, all business modules, reporting).
Phase 7 (QA hardening, load testing) is ongoing — see the master development instruction.
