# Vector Control backend

Vector Control is the internal CRM and business-operations backend for Vector Codes.

## Production architecture

- **Next.js server actions** handle authenticated application workflows.
- **Supabase Auth** authenticates founders, admins and staff.
- **Postgres + RLS** enforce row access and role boundaries.
- **Database triggers** enforce deal approvals, settled-payment immutability, commission calculation and sensitive audit events.
- **Generated types** live at `src/lib/database.types.ts`.
- **Server clients** live at `src/lib/supabase/server.ts`. The service-role client is server-only and must only be used after founder authorization.

## Roles

| Role | Access |
| --- | --- |
| Founder | Full company control, team administration, deal pricing/approval, project creation, finance and commission payouts |
| Admin | Operational management and finance; cannot approve deal pricing or commission payouts |
| Staff | Own/assigned prospects, outreach, draft deals and assigned tasks; no finance or company-wide records |

RLS remains the final enforcement layer. Hiding a page or button is not a security boundary.

## Financial invariants

1. A commission is created only when a successful payment is collected against a deal assigned to an active sales-staff profile.
2. The commission rate is fixed at **10%** in the database.
3. Refunds are separate successful transactions with `transaction_type = 'refund'`; the corresponding commission adjustment is negative.
4. Successful payment records are immutable, except for their notes. Do not change a settled payment to `refunded`.
5. Commission status transitions are `pending -> approved -> paid`, with `void` allowed from pending or approved.
6. The database sets approval/payout actor IDs and timestamps. A payout reference is mandatory before marking an entry paid.
7. Financial views use invoker security and are readable only by authenticated founder/admin users.

## Founder bootstrap

The founder email must be explicitly allowlisted. There is deliberately no “first person to sign up becomes founder” behavior.

Before creating the founder account, run this in the Supabase SQL editor, replacing the placeholder with the founder's verified login email:

```sql
INSERT INTO private.founder_allowlist (email)
VALUES (lower(trim('YOUR_FOUNDER_LOGIN_EMAIL')))
ON CONFLICT (email) DO NOTHING;
```

Then create the Auth account. The auth trigger provisions that account as an active founder. All other new accounts are created as inactive staff until the founder activates them.

If the founder Auth account already exists, add the email to the allowlist and promote the matching profile explicitly:

```sql
UPDATE public.profiles
SET role = 'founder', is_active = true
WHERE lower(email) = lower('YOUR_FOUNDER_LOGIN_EMAIL');
```

Do not put the service-role key or any other secret in browser code or a `NEXT_PUBLIC_*` variable.

## Required Vercel environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — server-only; required for founder-only staff invitations and profile administration

## Migration history warning

The live Supabase project records timestamped migration versions. The repository's original `0001`–`0009` SQL files are older numbered scripts and do not exactly match the current live schema or the remote migration history. Do **not** blindly replay that legacy chain against production or run a fresh `supabase db push` until the baseline/history has been reconciled.

The additive hardening scripts `0010`–`0012` are committed here and have been applied successfully to the live project. The live migration history currently includes:
- `backend_security_and_financial_integrity`
- `ledger_edge_case_fixes`
- `founder_pricing_and_server_owned_payout_metadata`

Before adopting CLI-based migrations for a new environment, create and verify a canonical baseline snapshot and align local migration filenames with the remote version IDs. Never rewrite already-applied production migration history.

## Security verification

After schema changes, check Supabase Security, Performance and Health advisors. Verify:
- no anonymous grants on public business tables;
- no authenticated DELETE/TRUNCATE grants;
- every foreign key has a supporting index;
- all sensitive tables retain RLS;
- financial views remain invoker-security views;
- successful-payment and commission-ledger triggers remain enabled.
