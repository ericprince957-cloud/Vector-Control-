# Vector Control

Private CRM and business management platform for **Vector Codes**, founded by Prince Eric.

Vector Control centralises prospecting, outreach, deals, client projects, tasks, payments, expenses, staff administration and business reporting.

## Stack

- Next.js App Router, TypeScript and React
- Tailwind CSS v4 and Lucide icons
- Supabase Auth, PostgreSQL and Row Level Security
- Recharts and Zod
- Vercel deployment

## Repository

https://github.com/ericprince957-cloud/Vector-Control-

## Environment variables

| Variable | Visibility | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Browser-safe publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only secret** | Founder-only staff invitations and profile administration |
| `NEXT_PUBLIC_APP_URL` | Public | Password-reset redirect base URL |

Copy `.env.example` to `.env.local` for local development. Never commit `.env.local` or expose the service-role key in client-side code. Add the same variables to Vercel Project Settings → Environment Variables.

## Live Supabase project

- Project name: `Vector-Control-`
- Project reference: `qbmvpmtcelztuzxyifcp`
- Region: `eu-central-2`
- Currency: NGN only

The connected live database is the current source of truth. It has the role-scoped access hardening migration `role_scoped_access_and_finance_view_hardening` and the commission ledger migrations `commission_ledger_for_collected_payments` and `restrict_commission_updates_to_approval_fields`.

**Migration drift warning:** The older numbered SQL files `0001_schema.sql` through `0004_security_alignment.sql` do not exactly describe the current live schema/history. Do not blindly replay them against the existing project. Reconcile them into a clean baseline before using them to provision a fresh production database.

## Authentication and founder provisioning

- There is no public staff registration page. Staff access is invitation-only.
- New Auth users receive an inactive staff profile by database trigger.
- The founder must activate invited staff and assign their role from the founder-only Staff page.
- The first founder account must be provisioned explicitly in Supabase Auth and then promoted/activated in the matching `public.profiles` row.
- Only the founder can invite, activate, deactivate or change staff roles.
- Privileged staff administration uses the server-only service-role key after the caller's founder identity is verified.
- Inactive users are redirected to a clear access-restricted page and can sign out.

## Access model

- Founder/admin: business-wide CRM and finance access.
- Staff: only records they created or were assigned; no payments, expenses, financial reports or staff administration.
- RLS is enabled on every public business table.
- Financial views use `security_invoker = true` so underlying table policies are enforced.
- Anonymous access to business tables and financial views is revoked.

## Financial and commission rules

1. A won deal is not revenue.
2. Revenue is successful payment transactions minus successful refunds.
3. Pending and failed payments do not count as revenue.
4. Expenses are tracked separately.
5. Net operating result = net revenue − expenses.
6. Outstanding balance = won deal value − net successful payments for that deal, minimum zero.
7. All business amounts are NGN.
8. Sales commission is 10% of eligible successful client payments actually received, not deal value or unpaid invoices.
9. Successful refunds create negative commission adjustments.
10. Commission entries are generated from the sales representative assigned to the deal when the payment is recorded.
11. Only the founder can approve or void commission entries and record net payouts per representative.
12. Approved negative refund adjustments carry forward and reduce the next net payout.
13. Successful payment records are immutable; record refunds as separate refund transactions.

Commission payout batches are recorded manually after an actual bank transfer or other agreed payout. The system stores the payout reference; it does not initiate bank transfers.

## Soft-delete and audit policy

- Ordinary users do not hard-delete business records.
- Prospects are archived through status changes.
- Deals, projects and tasks are cancelled through status changes.
- Rejection history is preserved.
- Important administrative and business actions are written to audit logs.

## Current MVP modules

- Overview and reporting
- Prospects and outreach history
- Deals and sales pipeline
- Projects and delivery tracking
- Commission ledger (staff can view their own; founder controls approval and payout)
- Finance (founder/admin only)
- Rejections
- Tasks
- Founder-only staff management
- Account and system settings

## Development

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

## Production readiness checklist

- [ ] Provision the founder account and verify founder access.
- [ ] Add all production environment variables in Vercel.
- [ ] Verify invitation email and staff activation.
- [ ] Test role boundaries using founder, admin and staff accounts.
- [ ] Test every CRM create/update workflow.
- [ ] Test payment and expense workflows as founder/admin.
- [ ] Verify staff cannot read financial tables or views through the Data API.
- [ ] Reconcile migration files into a reproducible clean baseline.
- [ ] Complete mobile and end-to-end testing before hiring.
