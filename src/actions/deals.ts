'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { dealSchema, parseOrError } from '@/lib/validators';
import { runAction, audit, blankToNull, withAuditWarning } from './helpers';

export async function saveDeal(formData: FormData) {
  return runAction(async (profile) => {
    const { data, error } = parseOrError(dealSchema, formData);
    if (error) throw new Error(error);
    const supabase = await createClient();

    const values = {
      title: data.title,
      prospect_id: data.prospect_id,
      description: data.description ?? '',
      deal_value: data.deal_value,
      currency: data.currency,
      expected_close_date: blankToNull(data.expected_close_date as string),
      assigned_to: blankToNull(data.assigned_to),
      status: data.status,
      won_at: data.status === 'won' ? new Date().toISOString() : null
    };

    const id = blankToNull(formData.get('id'));
    if (id) {
      const { error: upErr } = await supabase.from('deals').update(values).eq('id', id);
      if (upErr) throw upErr;
      revalidatePath('/deals');
      return withAuditWarning('Deal updated', await audit('update', 'deal', id, { status: data.status }));
    }

    const { data: created, error: inErr } = await supabase
      .from('deals')
      .insert({ ...values, created_by: profile.id })
      .select('id')
      .single();
    if (inErr) throw inErr;
    revalidatePath('/deals');
    return withAuditWarning('Deal created', await audit('create', 'deal', created.id, { title: data.title }));
  });
}

export async function updateDealStatus(formData: FormData) {
  return runAction(async () => {
    const supabase = await createClient();
    const id = String(formData.get('id'));
    const status = String(formData.get('status'));
    const { error } = await supabase
      .from('deals')
      .update({ status, won_at: status === 'won' ? new Date().toISOString() : null })
      .eq('id', id);
    if (error) throw error;
    revalidatePath('/deals');
    return withAuditWarning(`Deal marked ${status.replace('_', ' ')}`, await audit('status_change', 'deal', id, { status }));
  });
}

export async function convertDealToProject(formData: FormData) {
  return runAction(async (profile) => {
    const supabase = await createClient();
    const dealId = String(formData.get('id'));
    const { data: deal } = await supabase
      .from('deals')
      .select('id, title, description, deal_value, currency, assigned_to, status, prospect_id(company_name)')
      .eq('id', dealId)
      .single();
    if (!deal) throw new Error('Deal not found');
    if (deal.status !== 'won') throw new Error('Only won deals can be converted to projects');

    const clientName = (deal.prospect_id as unknown as { company_name: string } | null)?.company_name ?? '';
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        deal_id: deal.id,
        prospect_id: deal.prospect_id as unknown as string,
        client_name: clientName,
        project_name: `Project — ${deal.title}`,
        description: deal.description || '',
        contract_value: deal.deal_value ?? 0,
        currency: deal.currency ?? 'NGN',
        assigned_to: deal.assigned_to,
        status: 'not_started',
        created_by: profile.id
      })
      .select('id')
      .single();
    if (error) throw error;
    revalidatePath('/projects');
    revalidatePath('/deals');
    return withAuditWarning('Project created from deal', await audit('convert', 'deal', dealId, { project_id: project.id }));
  });
}
