-- Limit founder commission updates to workflow fields only.
REVOKE UPDATE ON TABLE public.commission_entries FROM authenticated;
GRANT UPDATE (status, approved_by, approved_at, paid_by, paid_at, payout_reference)
ON TABLE public.commission_entries TO authenticated;
