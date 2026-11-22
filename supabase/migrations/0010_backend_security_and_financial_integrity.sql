-- Vector Control 0010: production security and financial integrity hardening
-- Safe additive migration. Preserves all existing records and table structures.

-- 1) Remove broad table privileges (including DELETE/TRUNCATE) and grant only
--    the operations required by the authenticated application.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, PUBLIC, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, PUBLIC, authenticated;

GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, avatar_url) ON public.profiles TO authenticated;

GRANT SELECT, INSERT, UPDATE ON
  public.prospects,
  public.outreach_activities,
  public.deals,
  public.rejections,
  public.projects,
  public.tasks
TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.payments, public.expenses TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.company_settings TO authenticated;

GRANT SELECT ON public.commission_entries TO authenticated;
GRANT UPDATE (status, approved_by, approved_at, paid_by, paid_at, payout_reference)
  ON public.commission_entries TO authenticated;

GRANT SELECT ON public.financial_overview, public.deal_financial_summary TO authenticated;

-- 2) Tighten direct audit inserts so a user cannot attribute an event to another user.
DROP POLICY IF EXISTS audit_logs_insert_active_team ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_insert_own ON public.audit_logs;
CREATE POLICY audit_logs_insert_own
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (
    private.is_active_user()
    AND actor_id = (SELECT auth.uid())
  );

-- 3) Founder bootstrap is explicit. No public "first signup becomes founder" rule.
--    Add the founder's verified email to private.founder_allowlist before signup.
CREATE TABLE IF NOT EXISTS private.founder_allowlist (
  email text PRIMARY KEY CHECK (email = lower(trim(email))),
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE private.founder_allowlist FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_founder boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM private.founder_allowlist allowlist
    WHERE allowlist.email = lower(trim(COALESCE(NEW.email, '')))
  ) INTO v_is_founder;

  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (
    NEW.id,
    lower(NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    CASE WHEN v_is_founder THEN 'founder' ELSE 'staff' END,
    v_is_founder
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Backfill any Auth users that pre-date the profile trigger. Non-allowlisted
-- accounts are inactive staff until the founder explicitly activates them.
INSERT INTO public.profiles (id, email, full_name, role, is_active)
SELECT
  u.id,
  lower(u.email),
  COALESCE(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
  CASE WHEN EXISTS (
    SELECT 1 FROM private.founder_allowlist a
    WHERE a.email = lower(trim(COALESCE(u.email, '')))
  ) THEN 'founder' ELSE 'staff' END,
  EXISTS (
    SELECT 1 FROM private.founder_allowlist a
    WHERE a.email = lower(trim(COALESCE(u.email, '')))
  )
FROM auth.users u
WHERE u.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- 4) Successful payments are ledger entries. Correct them with a separate
--    refund transaction; never rewrite a settled payment.
CREATE OR REPLACE FUNCTION private.guard_settled_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status IN ('successful', 'refunded')
     AND (to_jsonb(NEW) - 'notes' - 'updated_at')
         IS DISTINCT FROM
         (to_jsonb(OLD) - 'notes' - 'updated_at') THEN
    RAISE EXCEPTION 'Settled payment records are immutable. Record a separate refund transaction.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_guard_settled ON public.payments;
CREATE TRIGGER payments_guard_settled
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION private.guard_settled_payment();
REVOKE ALL ON FUNCTION private.guard_settled_payment() FROM PUBLIC, anon, authenticated;

-- 5) Enforce the company's fixed 10% commission rate and safe payout transitions.
CREATE OR REPLACE FUNCTION private.guard_commission_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.commission_rate <> 10.00
     OR NEW.commission_amount <> round(NEW.eligible_amount * 0.10, 2) THEN
    RAISE EXCEPTION 'Commission must equal exactly 10%% of the eligible collected amount.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
      IF NEW.approved_by IS DISTINCT FROM OLD.approved_by
         OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
         OR NEW.paid_by IS DISTINCT FROM OLD.paid_by
         OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
         OR NEW.payout_reference IS DISTINCT FROM OLD.payout_reference THEN
        RAISE EXCEPTION 'Commission approval and payout metadata can only change during a status transition.';
      END IF;
    ELSIF OLD.status = 'pending' AND NEW.status = 'approved' THEN
      NEW.approved_by := (SELECT auth.uid());
      NEW.approved_at := now();
      NEW.paid_by := NULL;
      NEW.paid_at := NULL;
      NEW.payout_reference := '';
    ELSIF OLD.status = 'pending' AND NEW.status = 'void' THEN
      NEW.approved_by := NULL;
      NEW.approved_at := NULL;
      NEW.paid_by := NULL;
      NEW.paid_at := NULL;
      NEW.payout_reference := '';
    ELSIF OLD.status = 'approved' AND NEW.status = 'paid' THEN
      NEW.paid_by := (SELECT auth.uid());
      NEW.paid_at := now();
    ELSIF OLD.status = 'approved' AND NEW.status = 'void' THEN
      NEW.paid_by := NULL;
      NEW.paid_at := NULL;
      NEW.payout_reference := '';
    ELSE
      RAISE EXCEPTION 'Invalid commission transition: % to %.', OLD.status, NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commission_entries_guard_workflow ON public.commission_entries;
CREATE TRIGGER commission_entries_guard_workflow
BEFORE INSERT OR UPDATE ON public.commission_entries
FOR EACH ROW EXECUTE FUNCTION private.guard_commission_entry();
REVOKE ALL ON FUNCTION private.guard_commission_entry() FROM PUBLIC, anon, authenticated;

-- 6) Only staff-assigned deals earn sales commission. Refund transactions create
--    negative commission adjustments through the existing payment trigger.
CREATE OR REPLACE FUNCTION private.sync_commission_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deal_id uuid;
  v_staff_id uuid;
  v_client_name text;
  v_deal_title text;
  v_eligible_amount numeric(14,2);
BEGIN
  IF NEW.status <> 'successful' THEN
    IF TG_OP = 'UPDATE' THEN
      UPDATE public.commission_entries
      SET status = 'void', updated_at = now()
      WHERE payment_id = NEW.id AND status = 'pending';
    END IF;
    RETURN NEW;
  END IF;

  v_deal_id := NEW.deal_id;
  IF v_deal_id IS NULL AND NEW.project_id IS NOT NULL THEN
    SELECT pr.deal_id INTO v_deal_id
    FROM public.projects pr
    WHERE pr.id = NEW.project_id;
  END IF;
  IF v_deal_id IS NULL THEN RETURN NEW; END IF;

  SELECT d.assigned_to, COALESCE(p.company_name, d.title), d.title
  INTO v_staff_id, v_client_name, v_deal_title
  FROM public.deals d
  LEFT JOIN public.prospects p ON p.id = d.prospect_id
  JOIN public.profiles staff_profile
    ON staff_profile.id = d.assigned_to
   AND staff_profile.role = 'staff'
  WHERE d.id = v_deal_id;

  IF v_staff_id IS NULL THEN RETURN NEW; END IF;

  v_eligible_amount := CASE
    WHEN NEW.transaction_type = 'refund' THEN -NEW.amount
    ELSE NEW.amount
  END;

  INSERT INTO public.commission_entries (
    staff_id, payment_id, deal_id, client_name, deal_title,
    eligible_amount, commission_rate, commission_amount, status
  ) VALUES (
    v_staff_id, NEW.id, v_deal_id, COALESCE(v_client_name, ''),
    COALESCE(v_deal_title, ''), v_eligible_amount, 10.00,
    ROUND(v_eligible_amount * 0.10, 2), 'pending'
  )
  ON CONFLICT (payment_id) DO UPDATE
  SET eligible_amount = EXCLUDED.eligible_amount,
      commission_rate = 10.00,
      commission_amount = EXCLUDED.commission_amount,
      updated_at = now()
  WHERE public.commission_entries.status = 'pending';

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.sync_commission_entry() FROM PUBLIC, anon, authenticated;

-- 7) Append-only audit evidence for sensitive records. This supplements the
--    semantic audit events written by the application server actions.
CREATE OR REPLACE FUNCTION private.audit_sensitive_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_before jsonb;
  v_after jsonb;
  v_entity_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_before := to_jsonb(OLD);
    v_after := NULL;
    v_entity_id := (v_before ->> 'id')::uuid;
  ELSIF TG_OP = 'INSERT' THEN
    v_before := NULL;
    v_after := to_jsonb(NEW);
    v_entity_id := (v_after ->> 'id')::uuid;
  ELSE
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
    v_entity_id := (v_after ->> 'id')::uuid;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (
    (SELECT auth.uid()),
    lower(TG_OP),
    TG_TABLE_NAME,
    v_entity_id,
    jsonb_build_object('before', v_before, 'after', v_after)
  );

  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.audit_sensitive_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_payments_changes ON public.payments;
CREATE TRIGGER audit_payments_changes
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION private.audit_sensitive_change();

DROP TRIGGER IF EXISTS audit_expenses_changes ON public.expenses;
CREATE TRIGGER audit_expenses_changes
AFTER INSERT OR UPDATE OR DELETE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION private.audit_sensitive_change();

DROP TRIGGER IF EXISTS audit_commission_changes ON public.commission_entries;
CREATE TRIGGER audit_commission_changes
AFTER INSERT OR UPDATE OR DELETE ON public.commission_entries
FOR EACH ROW EXECUTE FUNCTION private.audit_sensitive_change();

DROP TRIGGER IF EXISTS audit_company_settings_changes ON public.company_settings;
CREATE TRIGGER audit_company_settings_changes
AFTER INSERT OR UPDATE OR DELETE ON public.company_settings
FOR EACH ROW EXECUTE FUNCTION private.audit_sensitive_change();

DROP TRIGGER IF EXISTS audit_profile_changes ON public.profiles;
CREATE TRIGGER audit_profile_changes
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.audit_sensitive_change();

-- 8) Index every operational foreign key used by scoped policies and joins.
CREATE INDEX IF NOT EXISTS tasks_deal_id_idx ON public.tasks(deal_id);
CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS tasks_created_by_idx ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS commission_entries_deal_id_idx ON public.commission_entries(deal_id);
CREATE INDEX IF NOT EXISTS commission_entries_approved_by_idx ON public.commission_entries(approved_by);
CREATE INDEX IF NOT EXISTS commission_entries_paid_by_idx ON public.commission_entries(paid_by);

COMMENT ON TABLE public.commission_entries IS
  'Immutable 10% commission ledger derived from successful payment and refund transactions.';
COMMENT ON TABLE public.audit_logs IS
  'Restricted audit evidence. Sensitive record changes are written by database triggers.';
