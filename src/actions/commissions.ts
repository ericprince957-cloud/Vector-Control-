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
      void: 'pending'
    };
    const previousStatus = transitions[nextStatus];
    if (!previousStatus) throw new Error('Invalid commission action');

    const values: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === 'approved') {
      values.approved_by = profile.id;
      values.approved_at = new Date().toISOString();
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
      nextStatus === 'approved' ? 'Commission approved' : 'Pending commission voided',
      await audit('status_change', 'commission_entry', id, { status: nextStatus })
    );
  });
}

export async function payApprovedCommissionBatch(formData: FormData) {
  return runAction(async (profile) => {
    if (profile.role !== 'founder') throw new Error('Only the founder can process commission payouts');
    const staffId = String(formData.get('staff_id') ?? '').trim();
    const payoutReference = String(formData.get('payout_reference') ?? '').trim();
    if (!staffId) throw new Error('Select a sales representative');
    if (!payoutReference) throw new Error('Enter the bank transfer or payout reference');

    const supabase = await createClient();
    const { data: entries, error: readError } = await supabase
      .from('commission_entries')
      .select('id, commission_amount')
      .eq('staff_id', staffId)
      .eq('status', 'approved');
    if (readError) throw readError;
    const netAmount = (entries ?? []).reduce((sum, entry) => sum + Number(entry.commission_amount), 0);
    if (!entries?.length || netAmount <= 0) {
      throw new Error('There is no positive net approved commission to pay. Negative refund adjustments carry forward.');
    }

    const { data: updated, error } = await supabase
      .from('commission_entries')
      .update({
        status: 'paid',
        paid_by: profile.id,
        paid_at: new Date().toISOString(),
        payout_reference: payoutReference
      })
      .eq('staff_id', staffId)
      .eq('status', 'approved')
      .select('id');
    if (error) throw error;
    if (!updated?.length) throw new Error('No approved commission entries were available for payout');

    revalidatePath('/commissions');
    return withAuditWarning(
      `Net commission payout of ₦${netAmount.toLocaleString('en-NG')} recorded for ${updated.length} entries`,
      await audit('commission_payout', 'commission_entry', null, { staff_id: staffId, amount: netAmount, entries: updated.length, payout_reference: payoutReference })
    );
  });
}
