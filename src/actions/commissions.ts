'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { runAction, audit, withAuditWarning } from './helpers';

export async function updateCommissionStatus(formData: FormData) {
  return runAction(async (profile) => {
    if (profile.role !== 'founder') throw new Error('Only the founder can approve or pay commissions');

    const id = String(formData.get('id') ?? '').trim();
    const nextStatus = String(formData.get('status') ?? '').trim();
    if (!id) throw new Error('Commission record is missing');

    const transitions: Record<string, string> = {
      approved: 'pending',
      paid: 'approved',
      void: 'pending'
    };
    const previousStatus = transitions[nextStatus];
    if (!previousStatus) throw new Error('Invalid commission action');

    const values: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === 'approved') {
      values.approved_by = profile.id;
      values.approved_at = new Date().toISOString();
    }
    if (nextStatus === 'paid') {
      values.paid_by = profile.id;
      values.paid_at = new Date().toISOString();
      values.payout_reference = String(formData.get('payout_reference') ?? '').trim();
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('commission_entries')
      .update(values)
      .eq('id', id)
      .eq('status', previousStatus)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('This commission has already changed. Refresh and try again.');

    revalidatePath('/commissions');
    return withAuditWarning(
      nextStatus === 'approved' ? 'Commission approved' : nextStatus === 'paid' ? 'Commission marked as paid' : 'Pending commission voided',
      await audit('status_change', 'commission_entry', id, { status: nextStatus })
    );
  });
}
