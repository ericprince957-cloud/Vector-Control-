-- Vector Control — commission ledger.
-- Automatically records 10% commission only when a successful payment is received
-- against a deal assigned to a sales representative. Successful refunds create
-- negative commission adjustments. The founder controls approval and payout.

CREATE TABLE public.commission_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.profiles(id),
  payment_id uuid NOT NULL UNIQUE REFERENCES public.payments(id),
  deal_id uuid NOT NULL REFERENCES public.deals(id),
  client_name text NOT NULL DEFAULT '',
  deal_title text NOT NULL DEFAULT '',
  eligible_amount numeric(14,2) NOT NULL,
  commission_rate numeric(5,2) NOT NULL DEFAULT 10.00 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  commission_amount numeric(14,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','void')),
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  paid_by uuid REFERENCES public.profiles(id),
  paid_at timestamptz,
  payout_reference text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX commission_entries_staff_status_idx ON public.commission_entries(staff_id, status);
CREATE INDEX commission_entries_created_at_idx ON public.commission_entries(created_at DESC);

ALTER TABLE public.commission_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.commission_entries FROM anon, PUBLIC, authenticated;
GRANT SELECT, UPDATE ON public.commission_entries TO authenticated;

CREATE OR REPLACE FUNCTION private.is_founder_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.is_active = true AND p.role = 'founder');
$$;

CREATE POLICY commission_entries_read_own_or_admin ON public.commission_entries
  FOR SELECT TO authenticated
  USING (private.is_admin_user() OR staff_id = (SELECT auth.uid()));
CREATE POLICY commission_entries_founder_update ON public.commission_entries
  FOR UPDATE TO authenticated
  USING (private.is_founder_user()) WITH CHECK (private.is_founder_user());

CREATE OR REPLACE FUNCTION private.sync_commission_entry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_deal_id uuid;
  v_staff_id uuid;
  v_client_name text;
  v_deal_title text;
  v_eligible_amount numeric(14,2);
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'successful' AND (
    NEW.status IS DISTINCT FROM OLD.status OR
    NEW.amount IS DISTINCT FROM OLD.amount OR
    NEW.deal_id IS DISTINCT FROM OLD.deal_id OR
    NEW.project_id IS DISTINCT FROM OLD.project_id OR
    NEW.transaction_type IS DISTINCT FROM OLD.transaction_type
  ) THEN
    RAISE EXCEPTION 'Successful payment records cannot be edited. Record a separate refund transaction.';
  END IF;

  IF NEW.status <> 'successful' THEN
    IF TG_OP = 'UPDATE' THEN
      UPDATE public.commission_entries SET status = 'void', updated_at = now()
      WHERE payment_id = NEW.id AND status = 'pending';
    END IF;
    RETURN NEW;
  END IF;

  v_deal_id := NEW.deal_id;
  IF v_deal_id IS NULL AND NEW.project_id IS NOT NULL THEN
    SELECT p.deal_id INTO v_deal_id FROM public.projects p WHERE p.id = NEW.project_id;
  END IF;
  IF v_deal_id IS NULL THEN RETURN NEW; END IF;

  SELECT d.assigned_to, COALESCE(p.company_name, d.title), d.title
  INTO v_staff_id, v_client_name, v_deal_title
  FROM public.deals d LEFT JOIN public.prospects p ON p.id = d.prospect_id
  WHERE d.id = v_deal_id;
  IF v_staff_id IS NULL THEN RETURN NEW; END IF;

  v_eligible_amount := CASE WHEN NEW.transaction_type = 'refund' THEN -NEW.amount ELSE NEW.amount END;
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
      commission_amount = EXCLUDED.commission_amount, updated_at = now()
  WHERE public.commission_entries.status = 'pending';
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_commission_entry() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.is_founder_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_founder_user() TO authenticated;

CREATE TRIGGER payments_sync_commission_entry
AFTER INSERT OR UPDATE OF status, amount, deal_id, project_id, transaction_type
ON public.payments FOR EACH ROW EXECUTE FUNCTION private.sync_commission_entry();

CREATE OR REPLACE FUNCTION private.set_commission_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER commission_entries_set_updated_at
BEFORE UPDATE ON public.commission_entries
FOR EACH ROW EXECUTE FUNCTION private.set_commission_updated_at();
