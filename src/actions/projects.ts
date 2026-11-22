'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { projectSchema, parseOrError } from '@/lib/validators';
import { runAction, audit, blankToNull, withAuditWarning } from './helpers';

export async function saveProject(formData: FormData) {
  return runAction(async (profile) => {
    const { data, error } = parseOrError(projectSchema, formData);
    if (error || !data) throw new Error(error || 'Invalid form data');
    const supabase = await createClient();
    let assignedTo = profile.role === 'staff' ? profile.id : blankToNull(data.assigned_to);
    if (!assignedTo && data.deal_id) {
      const { data: deal } = await supabase.from('deals').select('assigned_to').eq('id', data.deal_id).maybeSingle();
      assignedTo = deal?.assigned_to ?? null;
    }

    const values = {
      project_name: data.project_name,
      client_name: data.client_name ?? '',
      deal_id: blankToNull(data.deal_id),
      description: data.description ?? '',
      contract_value: data.contract_value,
      currency: data.currency,
      start_date: blankToNull(data.start_date as string),
      due_date: blankToNull(data.due_date as string),
      assigned_to: assignedTo,
      status: data.status,
      completed_at: data.status === 'completed' ? new Date().toISOString() : null
    };

    const id = blankToNull(formData.get('id'));
    if (id) {
      const { error: upErr } = await supabase.from('projects').update(values).eq('id', id);
      if (upErr) throw upErr;
      revalidatePath('/projects');
      return withAuditWarning('Project updated', await audit('update', 'project', id, { status: data.status }));
    }

    const { data: created, error: inErr } = await supabase
      .from('projects')
      .insert({ ...values, created_by: profile.id })
      .select('id')
      .single();
    if (inErr) throw inErr;
    revalidatePath('/projects');
    return withAuditWarning('Project created', await audit('create', 'project', created.id, { name: data.project_name }));
  });
}
