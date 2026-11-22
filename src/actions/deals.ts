'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { TablesUpdate } from '@/lib/database.types';
import { dealSchema, parseOrError } from '@/lib/validators';
import { runAction, audit, blankToNull, withAuditWarning } from './helpers';

export async function saveDeal(formData: FormData) {
  return runAction(async (profile) => {
    const { data, error } = parseOrError(dealSchema, formData);
    if (error || !data) throw new Error(error || 'Invalid deal data');
    const supabase = await createClient();
    const id = blankToNull(formData.get('id'));

    if (!id && profile.role === 'admin') {
      throw new Error('Admins can manage deal assignments, but new sales deals must be created by the founder or assigned sales representative.');
    }
    if (!id && profile.role === 'staff' && data.status !== 'draft') {
      throw new Error('Sales staff can only create draft deals. The founder approves proposals and pricing.');
    }

    let assignedTo = profile.role === 'staff' ? profile.id : blankToNull(data.assigned_to);
    if (!assignedTo) {
      const { data: prospect } = await supabase.from('prospects').select('assigned_to').eq('id', data.prospect_id).maybeSingle();
      assignedTo = prospect?.assigned_to ?? null;
    }

    const amountPaid = Number(formData.get('amount_paid') ?? 0);
    if (amountPaid > Number(data.deal_value)) throw new Error('Amount paid cannot exceed the deal value.');

    const values: TablesUpdate<'deals'> = {
      title: data.title,
      prospect_id: data.prospect_id,
      description: data.description ?? '',
      deal_value: profile.role === 'staff' && !id ? 0 : data.deal_value,
      currency: data.currency,
      expected_close_date: blankToNull(data.expected_close_date as string),
      assigned_to: assignedTo,
      status: data.status,
      won_at: data.status === 'won' ? new Date().toISOString() : null
    };

    if (id && profile.role !== 'founder') {
      delete values.deal_value;
      delete values.currency;
      delete values.won_at;
    }

    if (id) {
      const { error: upErr } = await supabase.from('deals').update(values).eq('id', id);
      if (upErr) throw upErr;
      if (amountPaid > 0) {
        const { error: payErr } = await supabase.from('payments').insert({
          deal_id: id, prospect_id: data.prospect_id, client_name: data.title, amount: amountPaid, currency: data.currency,
          status: 'successful', payment_method: 'bank_transfer', paid_at: new Date().toISOString().slice(0, 10),
          transaction_type: 'payment', notes: 'Payment recorded from deal form', recorded_by: profile.id
        });
        if (payErr) throw payErr;
      }
      revalidatePath('/deals');
      revalidatePath('/finance');
      return withAuditWarning('Deal updated', await audit('update', 'deal', id, { status: data.status }));
    }

    const { data: created, error: inErr } = await supabase
      .from('deals')
      .insert({ ...values, created_by: profile.id })
      .select('id')
      .single();
    if (inErr) throw inErr;
    if (amountPaid > 0) {
      const { error: payErr } = await supabase.from('payments').insert({
        deal_id: created.id, prospect_id: data.prospect_id, client_name: data.title, amount: amountPaid, currency: data.currency,
        status: 'successful', payment_method: 'bank_transfer', paid_at: new Date().toISOString().slice(0, 10),
        transaction_type: 'payment', notes: 'Initial payment recorded from deal form', recorded_by: profile.id
      });
      if (payErr) throw payErr;
    }
    revalidatePath('/deals');
    revalidatePath('/finance');
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
    if (profile.role !== 'founder') throw new Error('Only the founder can convert a won deal into a client project');
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

export async function deleteDeal(formData: FormData) {
  return runAction(async (profile) => {
    if (profile.role !== 'founder') throw new Error('Only the founder can permanently delete deals.');
    const id = String(formData.get('id') ?? '');
    if (!id) throw new Error('Deal ID is required');
    const supabase = await createClient();
    const { error } = await supabase.from('deals').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/deals');
    revalidatePath('/projects');
    revalidatePath('/finance');
    return withAuditWarning('Deal deleted', await audit('delete', 'deal', id));
  });
}
