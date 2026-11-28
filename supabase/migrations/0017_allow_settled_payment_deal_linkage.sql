-- Allow an existing settled payment to be attached to its originating deal.
-- All financial fields remain immutable; a non-null deal_id cannot be changed.
CREATE OR REPLACE FUNCTION private.guard_settled_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'refunded' THEN
    RAISE EXCEPTION 'Do not mark an original payment as refunded. Record a separate successful refund transaction.';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IN ('successful', 'refunded') THEN
    IF (to_jsonb(NEW) - 'notes' - 'updated_at' - 'deal_id')
         IS DISTINCT FROM
       (to_jsonb(OLD) - 'notes' - 'updated_at' - 'deal_id')
       OR (OLD.deal_id IS NOT NULL AND NEW.deal_id IS DISTINCT FROM OLD.deal_id) THEN
      RAISE EXCEPTION 'Settled payment records are immutable. Only an unlinked payment may be attached to its originating deal.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_settled_payment() FROM PUBLIC, anon, authenticated;
