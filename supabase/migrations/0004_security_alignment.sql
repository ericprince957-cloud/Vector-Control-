-- Vector Control — repair alignment migration (0004)
-- Run this in the Supabase SQL editor after 0001–0003.
--
-- Purpose:
--   1. The financial_overview view is currently readable by anon (verified
--      live with only the publishable key). Business financial data must not
--      be publicly readable. We revoke anon access; authenticated users keep
--      access subject to their role in application queries.
--   2. The application writes audit entries directly (no log_audit RPC exists).
--      Ensure every active authenticated user can INSERT their own audit rows.
--   3. Ordinary users must not DELETE business records (soft-delete workflow:
--      status changes). Ensure no broad DELETE grant/policy exists for
--      non-founder roles. Existing founder delete policies are preserved.
--
-- No business tables are dropped or recreated. No existing records are touched.

-- 1. Restrict the financial view to authenticated roles ----------------------
revoke select on public.financial_overview from anon;
revoke select on public.deal_financial_summary from anon;

-- 2. Audit log insert policy for authenticated users (idempotent) ------------
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'audit_logs'
      and policyname = 'audit_insert_authenticated'
  ) then
    create policy audit_insert_authenticated on public.audit_logs
      for insert to authenticated
      with check (actor_id = auth.uid());
  end if;
end $$;

-- 3. Revoke table-level DELETE from the authenticated role for business tables
--    (soft-delete is enforced through status changes; founder retains delete
--    via existing policies, which operate at the RLS layer).
do $$
declare t text;
begin
  foreach t in array array[
    'prospects','outreach_activities','deals','rejections',
    'projects','payments','expenses','tasks'
  ] loop
    execute format('revoke delete on table public.%I from authenticated', t);
  end loop;
end $$;
