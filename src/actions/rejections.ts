'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { rejectionSchema, parseOrError } from '@/lib/validators';
import { runAction, audit, blankToNull, withAuditWarning } from './helpers';

export async function saveRejection(formData: FormData) {
  return runAction(async (profile) => {
    const { data, error } = parseOrError(rejectionSchema, formData);
    if (error || !data) throw new Error(error || 'Invalid form data');
    const supabase = await createClient();

    const { data: created, error: inErr } = await supabase
      .from('rejections')
      .insert({
        prospect_id: blankToNull(data.prospect_id),
        deal_id: blankToNull(data.deal_id),
        company_name: data.company_name ?? '',
        contact_name: data.contact_name ?? '',
        category: data.category,
        reason: data.reason ?? '',
        potential_value: data.potential_value,
        currency: data.currency,
        rejected_at: data.rejected_at,
        follow_up_possible: data.follow_up_possible === 'true',
        follow_up_at: blankToNull(data.follow_up_at as string),
        created_by: profile.id
      })
      .select('id')
      .single();
    if (inErr) throw inErr;

    // Preserve history: mark the linked prospect disqualified, never delete it.
    if (data.prospect_id) {
      await supabase.from('prospects').update({ status: 'disqualified' }).eq('id', data.prospect_id);
    }

    revalidatePath('/rejections');
    revalidatePath('/prospects');
    return withAuditWarning('Rejection recorded', await audit('create', 'rejection', created.id, { category: data.category }));
  });
}
