'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { outreachSchema, parseOrError } from '@/lib/validators';
import { runAction, audit, blankToNull } from './helpers';

export async function saveOutreach(formData: FormData) {
  return runAction(async (profile) => {
    const { data, error } = parseOrError(outreachSchema, formData);
    if (error) throw new Error(error);
    const supabase = await createClient();

    const values = {
      prospect_id: data.prospect_id,
      channel: data.channel,
      direction: data.direction,
      occurred_at: data.occurred_at,
      summary: data.summary ?? '',
      response: data.response ?? '',
      outcome: data.outcome,
      staff_id: blankToNull(data.staff_id) ?? profile.id,
      next_follow_up_date: blankToNull(data.next_follow_up_date as string)
    };

    const { data: created, error: dbErr } = await supabase
      .from('outreach_activities')
      .insert(values)
      .select('id, prospect_id')
      .single();
    if (dbErr) throw dbErr;

    // keep prospect contact status in sync
    await supabase
      .from('prospects')
      .update({
        last_contact_at: data.occurred_at.slice(0, 10),
        next_follow_up_date: values.next_follow_up_date,
        status: data.outcome === 'interested' ? 'interested'
          : data.outcome === 'not_interested' ? 'disqualified'
          : 'contacted'
      })
      .eq('id', data.prospect_id);

    await audit('create', 'outreach', created.id, { channel: data.channel, outcome: data.outcome });
    revalidatePath('/outreach');
    revalidatePath('/prospects');
    return 'Outreach recorded';
  });
}

export async function deleteOutreach(formData: FormData) {
  return runAction(async () => {
    const supabase = await createClient();
    const id = String(formData.get('id'));
    const { error } = await supabase.from('outreach_activities').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/outreach');
    return 'Outreach record removed';
  });
}
