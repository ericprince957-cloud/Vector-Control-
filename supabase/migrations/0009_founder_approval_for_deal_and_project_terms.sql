-- Founder-only approval of deal pricing, final sales stages and client project terms.

CREATE OR REPLACE FUNCTION private.guard_deal_terms()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF private.is_founder_user() THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' OR NEW.assigned_to IS DISTINCT FROM (SELECT auth.uid()) THEN
      RAISE EXCEPTION 'Sales staff can only create draft deals assigned to themselves. Founder approval is required for proposals.';
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
DROP TRIGGER IF EXISTS deals_guard_terms ON public.deals;
CREATE TRIGGER deals_guard_terms BEFORE INSERT OR UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION private.guard_deal_terms();

DROP POLICY IF EXISTS deals_insert_scoped ON public.deals;
CREATE POLICY deals_insert_scoped ON public.deals FOR INSERT TO authenticated
WITH CHECK (private.is_founder_user() OR (
  private.is_active_user() AND created_by = (SELECT auth.uid())
  AND assigned_to = (SELECT auth.uid()) AND status = 'draft'
));

CREATE OR REPLACE FUNCTION private.guard_project_terms()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF private.is_founder_user() THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Only the founder can create client delivery projects.';
  END IF;
  IF NEW.contract_value IS DISTINCT FROM OLD.contract_value
     OR NEW.currency IS DISTINCT FROM OLD.currency THEN
    RAISE EXCEPTION 'Only the founder can change project contract terms.';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('completed','cancelled') THEN
    RAISE EXCEPTION 'Only the founder can close or cancel a client project.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS projects_guard_terms ON public.projects;
CREATE TRIGGER projects_guard_terms BEFORE INSERT OR UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION private.guard_project_terms();

DROP POLICY IF EXISTS projects_insert_scoped ON public.projects;
DROP POLICY IF EXISTS projects_update_scoped ON public.projects;
CREATE POLICY projects_insert_founder ON public.projects FOR INSERT TO authenticated
WITH CHECK (private.is_founder_user());
CREATE POLICY projects_update_admin ON public.projects FOR UPDATE TO authenticated
USING (private.is_admin_user()) WITH CHECK (private.is_admin_user());

REVOKE ALL ON FUNCTION private.guard_deal_terms() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.guard_project_terms() FROM PUBLIC, anon, authenticated;
