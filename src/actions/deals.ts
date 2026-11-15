'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { dealSchema, parseOrError } from '@/lib/validators';
import { runAction, audit, blankToNull } from './helpers';

export async function saveDeal(formData: FormData) {
  return runAction(async () => {
    const { data, error } = parseOrError(dealSchema, formData);
    if (error) throw new Error(error);
    const supabase = await createClient();

    const values = {
      title: data.title,
      prospect_id: data.prospect_id,
      description: data.description ?? '',
      service: data.service ?? '',
      quoted_amount: data.quoted_amount,
      negotiated_amount: data.negotiated_amount ?? null,
      expected_close_date: blankToNull(data.expected_close_date as string),
      assigned_to: blankToNull(data.assigned_to),
      status: data.status,
      proposal_notes: data.proposal_notes ?? '',
      contract_notes: data.contract_notes ?? '',
      closed_at: ['won', 'lost', 'cancelled'].includes(data.status) ? new Date().toISOString() : null
    };

    const id = blankToNull(formData.get('id'));
    if (id) {
      const { error: upErr } = await supabase.from('deals').update(values).eq('id', id);
      if (upErr) throw upErr;
      await audit('update', 'deal', id, { status: data.status });
      revalidatePath('/deals');
      return 'Deal updated';
    }

    const { data: created, error: inErr } = await supabase.from('deals').insert(values).select('id').single();
    if (inErr) throw inErr;
    await audit('create', 'deal', created.id, { title: data.title });
    revalidatePath('/deals');
    return 'Deal created';
  });
}

export async function updateDealStatus(formData: FormData) {
  return runAction(async () => {
    const supabase = await createClient();
    const id = String(formData.get('id'));
    const status = String(formData.get('status'));
    const closed = ['won', 'lost', 'cancelled'].includes(status);
    const { error } = await supabase
      .from('deals')
      .update({ status, closed_at: closed ? new Date().toISOString() : null })
      .eq('id', id);
    if (error) throw error;
    await audit('status_change', 'deal', id, { status });
    revalidatePath('/deals');
    return `Deal marked ${status.replace('_', ' ')}`;
  });
}

export async function convertDealToProject(formData: FormData) {
  return runAction(async () => {
    const supabase = await createClient();
    const dealId = String(formData.get('id'));
    const { data: deal } = await supabase
      .from('deals')
      .select('id, title, prospect_id, service, negotiated_amount, quoted_amount, assigned_to, status, prospect_id(prospects(company_name))')
      .eq('id', dealId)
      .single();
    if (!deal) throw new Error('Deal not found');
    if (deal.status !== 'won') throw new Error('Only won deals can be converted to projects');

    const clientName = (deal.prospect_id as unknown as { company_name: string })?.company_name ?? '';
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        name: `Project — ${deal.title}`,
        client_name: clientName,
        deal_id: deal.id,
        description: deal.description || '',
        contract_amount: deal.negotiated_amount ?? deal.quoted_amount ?? 0,
        assigned_to: deal.assigned_to,
        status: 'not_started'
      })
      .select('id')
      .single();
    if (error) throw error;
    await audit('convert', 'deal', dealId, { project_id: project.id });
    revalidatePath('/projects');
    revalidatePath('/deals');
    return 'Project created from deal';
  });
}

export async function deleteDeal(formData: FormData) {
  return runAction(async () => {
    const supabase = await createClient();
    const id = String(formData.get('id'));
    const { error } = await supabase.from('deals').delete().eq('id', id);
    if (error) throw error;
    await audit('delete', 'deal', id);
    revalidatePath('/deals');
    return 'Deal deleted';
  });
}
