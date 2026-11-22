-- Vector Control — role-scoped access and financial view hardening.
-- Applied to the live Supabase project as migration:
-- role_scoped_access_and_finance_view_hardening
-- Staff may access only their own/assigned operational records.
-- Financial records and financial reports are founder/admin only.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, PUBLIC;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.prospects, public.outreach_activities,
  public.deals, public.rejections, public.projects, public.tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payments, public.expenses TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.company_settings TO authenticated;

CREATE OR REPLACE VIEW public.deal_financial_summary
WITH (security_invoker = true) AS
SELECT d.id AS deal_id, d.title, d.deal_value, d.currency,
  COALESCE(SUM(CASE
    WHEN p.status = 'successful' AND p.transaction_type = 'payment' THEN p.amount
    WHEN p.status = 'successful' AND p.transaction_type = 'refund' THEN -p.amount
    ELSE 0 END), 0)::numeric(14,2) AS net_received,
  GREATEST(d.deal_value - COALESCE(SUM(CASE
    WHEN p.status = 'successful' AND p.transaction_type = 'payment' THEN p.amount
    WHEN p.status = 'successful' AND p.transaction_type = 'refund' THEN -p.amount
    ELSE 0 END), 0), 0)::numeric(14,2) AS outstanding_balance,
  d.status AS deal_status
FROM public.deals d
LEFT JOIN public.payments p
  ON p.deal_id = d.id
  OR (p.deal_id IS NULL AND p.project_id IN (
    SELECT pr.id FROM public.projects pr WHERE pr.deal_id = d.id
  ))
GROUP BY d.id, d.title, d.deal_value, d.currency, d.status;

CREATE OR REPLACE VIEW public.financial_overview
WITH (security_invoker = true) AS
SELECT 'NGN'::text AS currency,
  COALESCE((SELECT SUM(CASE
    WHEN p.status = 'successful' AND p.transaction_type = 'payment' THEN p.amount
    WHEN p.status = 'successful' AND p.transaction_type = 'refund' THEN -p.amount
    ELSE 0 END) FROM public.payments p), 0)::numeric(14,2) AS total_net_revenue,
  COALESCE((SELECT SUM(e.amount) FROM public.expenses e), 0)::numeric(14,2) AS total_expenses,
  (COALESCE((SELECT SUM(CASE
    WHEN p.status = 'successful' AND p.transaction_type = 'payment' THEN p.amount
    WHEN p.status = 'successful' AND p.transaction_type = 'refund' THEN -p.amount
    ELSE 0 END) FROM public.payments p), 0)
    - COALESCE((SELECT SUM(e.amount) FROM public.expenses e), 0))::numeric(14,2) AS net_operating_result,
  COALESCE((SELECT SUM(dfs.outstanding_balance)
    FROM public.deal_financial_summary dfs WHERE dfs.deal_status = 'won'), 0)::numeric(14,2) AS outstanding_balance,
  COALESCE((SELECT SUM(CASE
    WHEN p.status = 'successful' AND p.transaction_type = 'payment' THEN p.amount
    WHEN p.status = 'successful' AND p.transaction_type = 'refund' THEN -p.amount
    ELSE 0 END) FROM public.payments p
    WHERE COALESCE(p.paid_at, p.created_at) >= date_trunc('month', now())), 0)::numeric(14,2) AS current_month_net_revenue,
  COALESCE((SELECT SUM(e.amount) FROM public.expenses e
    WHERE e.expense_date >= date_trunc('month', now())::date), 0)::numeric(14,2) AS current_month_expenses;

REVOKE ALL ON public.financial_overview, public.deal_financial_summary FROM anon, PUBLIC;
GRANT SELECT ON public.financial_overview, public.deal_financial_summary TO authenticated;

DROP POLICY IF EXISTS prospects_read_active_team ON public.prospects;
DROP POLICY IF EXISTS prospects_update_active_team ON public.prospects;
DROP POLICY IF EXISTS prospects_insert_active_team ON public.prospects;
CREATE POLICY prospects_read_scoped ON public.prospects FOR SELECT TO authenticated
  USING (private.is_admin_user() OR assigned_to = (SELECT auth.uid()) OR created_by = (SELECT auth.uid()));
CREATE POLICY prospects_insert_scoped ON public.prospects FOR INSERT TO authenticated
  WITH CHECK (private.is_active_user() AND created_by = (SELECT auth.uid()));
CREATE POLICY prospects_update_scoped ON public.prospects FOR UPDATE TO authenticated
  USING (private.is_admin_user() OR assigned_to = (SELECT auth.uid()) OR created_by = (SELECT auth.uid()))
  WITH CHECK (private.is_admin_user() OR
    (created_by = (SELECT auth.uid()) AND (assigned_to IS NULL OR assigned_to = (SELECT auth.uid())))
    OR assigned_to = (SELECT auth.uid()));

DROP POLICY IF EXISTS outreach_read_active_team ON public.outreach_activities;
DROP POLICY IF EXISTS outreach_update_active_team ON public.outreach_activities;
DROP POLICY IF EXISTS outreach_insert_active_team ON public.outreach_activities;
CREATE POLICY outreach_read_scoped ON public.outreach_activities FOR SELECT TO authenticated
  USING (private.is_admin_user() OR created_by = (SELECT auth.uid()));
CREATE POLICY outreach_insert_scoped ON public.outreach_activities FOR INSERT TO authenticated
  WITH CHECK (private.is_active_user() AND created_by = (SELECT auth.uid()));
CREATE POLICY outreach_update_scoped ON public.outreach_activities FOR UPDATE TO authenticated
  USING (private.is_admin_user() OR created_by = (SELECT auth.uid()))
  WITH CHECK (private.is_admin_user() OR created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS deals_read_active_team ON public.deals;
DROP POLICY IF EXISTS deals_update_active_team ON public.deals;
DROP POLICY IF EXISTS deals_insert_active_team ON public.deals;
CREATE POLICY deals_read_scoped ON public.deals FOR SELECT TO authenticated
  USING (private.is_admin_user() OR assigned_to = (SELECT auth.uid()) OR created_by = (SELECT auth.uid()));
CREATE POLICY deals_insert_scoped ON public.deals FOR INSERT TO authenticated
  WITH CHECK (private.is_active_user() AND created_by = (SELECT auth.uid()));
CREATE POLICY deals_update_scoped ON public.deals FOR UPDATE TO authenticated
  USING (private.is_admin_user() OR assigned_to = (SELECT auth.uid()) OR created_by = (SELECT auth.uid()))
  WITH CHECK (private.is_admin_user() OR
    (created_by = (SELECT auth.uid()) AND (assigned_to IS NULL OR assigned_to = (SELECT auth.uid())))
    OR assigned_to = (SELECT auth.uid()));

DROP POLICY IF EXISTS rejections_read_active_team ON public.rejections;
DROP POLICY IF EXISTS rejections_update_active_team ON public.rejections;
DROP POLICY IF EXISTS rejections_insert_active_team ON public.rejections;
CREATE POLICY rejections_read_scoped ON public.rejections FOR SELECT TO authenticated
  USING (private.is_admin_user() OR created_by = (SELECT auth.uid()));
CREATE POLICY rejections_insert_scoped ON public.rejections FOR INSERT TO authenticated
  WITH CHECK (private.is_active_user() AND created_by = (SELECT auth.uid()));
CREATE POLICY rejections_update_scoped ON public.rejections FOR UPDATE TO authenticated
  USING (private.is_admin_user() OR created_by = (SELECT auth.uid()))
  WITH CHECK (private.is_admin_user() OR created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS projects_read_active_team ON public.projects;
DROP POLICY IF EXISTS projects_update_active_team ON public.projects;
DROP POLICY IF EXISTS projects_insert_active_team ON public.projects;
CREATE POLICY projects_read_scoped ON public.projects FOR SELECT TO authenticated
  USING (private.is_admin_user() OR assigned_to = (SELECT auth.uid()) OR created_by = (SELECT auth.uid()));
CREATE POLICY projects_insert_scoped ON public.projects FOR INSERT TO authenticated
  WITH CHECK (private.is_active_user() AND created_by = (SELECT auth.uid()));
CREATE POLICY projects_update_scoped ON public.projects FOR UPDATE TO authenticated
  USING (private.is_admin_user() OR assigned_to = (SELECT auth.uid()) OR created_by = (SELECT auth.uid()))
  WITH CHECK (private.is_admin_user() OR
    (created_by = (SELECT auth.uid()) AND (assigned_to IS NULL OR assigned_to = (SELECT auth.uid())))
    OR assigned_to = (SELECT auth.uid()));

DROP POLICY IF EXISTS tasks_read_active_team ON public.tasks;
DROP POLICY IF EXISTS tasks_update_active_team ON public.tasks;
DROP POLICY IF EXISTS tasks_insert_active_team ON public.tasks;
CREATE POLICY tasks_read_scoped ON public.tasks FOR SELECT TO authenticated
  USING (private.is_admin_user() OR assigned_to = (SELECT auth.uid()) OR created_by = (SELECT auth.uid()));
CREATE POLICY tasks_insert_scoped ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (private.is_active_user() AND created_by = (SELECT auth.uid()));
CREATE POLICY tasks_update_scoped ON public.tasks FOR UPDATE TO authenticated
  USING (private.is_admin_user() OR assigned_to = (SELECT auth.uid()) OR created_by = (SELECT auth.uid()))
  WITH CHECK (private.is_admin_user() OR
    (created_by = (SELECT auth.uid()) AND (assigned_to IS NULL OR assigned_to = (SELECT auth.uid())))
    OR assigned_to = (SELECT auth.uid()));

DROP POLICY IF EXISTS payments_read_active_team ON public.payments;
DROP POLICY IF EXISTS payments_insert_active_team ON public.payments;
DROP POLICY IF EXISTS payments_update_admin_only ON public.payments;
CREATE POLICY payments_admin_read ON public.payments FOR SELECT TO authenticated
  USING (private.is_admin_user());
CREATE POLICY payments_admin_insert ON public.payments FOR INSERT TO authenticated
  WITH CHECK (private.is_admin_user());
CREATE POLICY payments_admin_update ON public.payments FOR UPDATE TO authenticated
  USING (private.is_admin_user()) WITH CHECK (private.is_admin_user());

DROP POLICY IF EXISTS expenses_read_active_team ON public.expenses;
DROP POLICY IF EXISTS expenses_insert_active_team ON public.expenses;
DROP POLICY IF EXISTS expenses_update_admin_only ON public.expenses;
CREATE POLICY expenses_admin_read ON public.expenses FOR SELECT TO authenticated
  USING (private.is_admin_user());
CREATE POLICY expenses_admin_insert ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (private.is_admin_user());
CREATE POLICY expenses_admin_update ON public.expenses FOR UPDATE TO authenticated
  USING (private.is_admin_user()) WITH CHECK (private.is_admin_user());
