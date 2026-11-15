'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { outreachSchema, parseOrError } from '@/lib/validators';
import { runAction, audit, blankToNull, withAuditWarning } from './helpers';

export async function saveOutreach(formData: FormData) {
  return runAction(async (profile) => {
    const { data, error } = parseOrError(outreachSchema, formData);
    if (error) throw new Error(error);
    const supabase = await createClient();

    const { data: created, error: dbErr } = await supabase
      .from('outreach_activities')
      .insert({
        prospect_id: data.prospect_id,
        channel: data.channel,
        direction: data.direction,
        subject: data.subject ?? '',
        message_summary: data.message_summary ?? '',
        outcome: data.outcome,
        contacted_at: blankToNull(data.contacted_at as string) ?? new Date().toISOString(),
        next_follow_up_at: blankToNull(data.next_follow_up_at as string),
        created_by: profile.id
      })
      .select('id, prospect_id')
      .single();
    if (dbErr) throw dbErr;

    // Keep the prospect's follow-up date in sync; move status forward.
    await supabase
      .from('prospects')
      .update({
        next_follow_up_at: blankToNull(data.next_follow_up_at as string),
        status: data.outcome === 'interested' ? 'interested'
          : data.outcome === 'not_interested' ? 'disqualified'
          : 'contacted'
      })
      .eq('id', data.prospect_id);

    revalidatePath('/outreach');
    revalidatePath('/prospects');
    revalidatePath('/overview');
    return withAuditWarning('Outreach recorded', await audit('create', 'outreach', created.id, { channel: data.channel, outcome: data.outcome }));
  });
}
