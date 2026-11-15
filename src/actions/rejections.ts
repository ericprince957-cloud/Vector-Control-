'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { rejectionSchema, parseOrError } from '@/lib/validators';
import { runAction, audit, blankToNull } from './helpers';

export async function saveRejection(formData: FormData) {
  return runAction(async (profile) => {
    const { data, error } = parseOrError(rejectionSchema, formData);
    if (error) throw new Error(error);
    const supabase = await createClient();
    const { data: created, error: inErr } = await supabase
      .from('rejections')
      .insert({
        prospect_id: data.prospect_id,
        deal_id: blankToNull(data.deal_id),
        reason: data.reason,
        competitor: data.competitor ?? '',
        rejected_at: data.rejected_at,
        notes: data.notes ?? '',
        staff_id: profile.id
      })
      .select('id')
      .single();
    if (inErr) throw inErr;

    // mark the prospect disqualified so history is preserved, never deleted
    await supabase.from('prospects').update({ status: 'disqualified' }).eq('id', data.prospect_id);

    await audit('create', 'rejection', created.id, { reason: data.reason });
    revalidatePath('/rejections');
    revalidatePath('/prospects');
    return 'Rejection recorded';
  });
}
