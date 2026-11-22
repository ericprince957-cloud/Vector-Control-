-- Vector Control 0012: founder-controlled deal pricing and server-owned payout metadata.

CREATE OR REPLACE FUNCTION private.guard_deal_terms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.is_founder_user() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft'
       OR NEW.assigned_to IS DISTINCT FROM (SELECT auth.uid())
       OR NEW.deal_value <> 0 THEN
      RAISE EXCEPTION 'Sales staff can only create zero-value draft deals assigned to themselves. The founder must approve pricing and proposals.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.deal_value IS DISTINCT FROM OLD.deal_value
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.won_at IS DISTINCT FROM OLD.won_at THEN
    RAISE EXCEPTION 'Only the founder can approve or change deal pricing and contract terms.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (OLD.status = 'proposal_sent' AND NEW.status = 'negotiation') THEN
    RAISE EXCEPTION 'Only the founder can approve proposals, mark deals won/lost, or cancel deals.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_deal_terms() FROM PUBLIC, anon, authenticated;

-- The database owns approval/payout identity and timestamps. Authenticated
-- founders can request only a status transition and supply a payout reference.
REVOKE UPDATE (approved_by, approved_at, paid_by, paid_at)
  ON public.commission_entries FROM authenticated;
GRANT UPDATE (status, payout_reference)
  ON public.commission_entries TO authenticated;
