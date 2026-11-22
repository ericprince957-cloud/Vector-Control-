-- Vector Control 0011: close ledger edge cases and remove duplicate indexes.

DROP INDEX IF EXISTS public.tasks_deal_id_idx;
DROP INDEX IF EXISTS public.tasks_project_id_idx;

CREATE OR REPLACE FUNCTION private.guard_settled_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'refunded' THEN
    RAISE EXCEPTION 'Do not mark an original payment as refunded. Record a separate successful refund transaction.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('successful', 'refunded')
       AND (to_jsonb(NEW) - 'notes' - 'updated_at')
           IS DISTINCT FROM
           (to_jsonb(OLD) - 'notes' - 'updated_at') THEN
      RAISE EXCEPTION 'Settled payment records are immutable. Record a separate refund transaction.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_guard_settled ON public.payments;
CREATE TRIGGER payments_guard_settled
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION private.guard_settled_payment();

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
      IF length(trim(COALESCE(NEW.payout_reference, ''))) = 0 THEN
        RAISE EXCEPTION 'A payout reference is required before a commission can be marked paid.';
      END IF;
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

REVOKE ALL ON FUNCTION private.guard_settled_payment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.guard_commission_entry() FROM PUBLIC, anon, authenticated;
