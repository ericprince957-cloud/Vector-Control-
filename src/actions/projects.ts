'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { TablesUpdate } from '@/lib/database.types';
import { projectSchema, parseOrError } from '@/lib/validators';
import { runAction, audit, blankToNull, withAuditWarning } from './helpers';

export async function saveProject(formData: FormData) {
  return runAction(async (profile) => {
    const { data, error } = parseOrError(projectSchema, formData);
    if (error || !data) throw new Error(error || 'Invalid form data');
    const supabase = await createClient();
    const id = blankToNull(formData.get('id'));

    if (profile.role === 'staff') {
      throw new Error('Staff can work on assigned tasks, but project records are managed by the founder and admins.');
    }
    if (!id && profile.role !== 'founder') {
      throw new Error('Only the founder can create client delivery projects.');
    }

    let assignedTo = blankToNull(data.assigned_to);
    if (!assignedTo && data.deal_id) {
      const { data: deal } = await supabase.from('deals').select('assigned_to').eq('id', data.deal_id).maybeSingle();
      assignedTo = deal?.assigned_to ?? null;
    }

    const values: TablesUpdate<'projects'> = {
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

    if (id && profile.role !== 'founder') {
      delete values.contract_value;
      delete values.currency;
      delete values.completed_at;
    }

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

export async function deleteProject(formData: FormData) {
  return runAction(async (profile) => {
    if (profile.role !== 'founder') throw new Error('Only the founder can permanently delete projects.');
    const id = String(formData.get('id') ?? '');
    if (!id) throw new Error('Project ID is required');
    const supabase = await createClient();
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/projects');
    revalidatePath('/deals');
    revalidatePath('/finance');
    return withAuditWarning('Project deleted', await audit('delete', 'project', id));
  });
}
