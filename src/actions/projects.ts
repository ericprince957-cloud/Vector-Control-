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

const PROJECT_STATUS_VALUES = ['not_started', 'in_progress', 'review', 'completed', 'on_hold', 'cancelled'];

/** Quick status change from the list. Closing or cancelling a project is founder-only (also enforced in the database). */
export async function updateProjectStatus(formData: FormData) {
  return runAction(async (profile) => {
    const id = String(formData.get('id') ?? '').trim();
    const status = String(formData.get('status') ?? '').trim();
    if (!id) throw new Error('Project is missing');
    if (!PROJECT_STATUS_VALUES.includes(status)) throw new Error('Invalid status');
    if (profile.role === 'staff') throw new Error('Project records are managed by the founder and admins.');
    if (profile.role !== 'founder' && (status === 'completed' || status === 'cancelled')) {
      throw new Error('Only the founder can complete or cancel a project.');
    }
    const supabase = await createClient();
    const patch: TablesUpdate<'projects'> = { status: status as TablesUpdate<'projects'>['status'] };
    if (profile.role === 'founder') patch.completed_at = status === 'completed' ? new Date().toISOString() : null;
    const { data, error } = await supabase.from('projects').update(patch).eq('id', id).select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('Could not update this project');
    revalidatePath('/projects');
    revalidatePath(`/projects/${id}`);
    revalidatePath('/overview');
    return withAuditWarning(`Status set to ${status === 'review' ? 'under review' : status.replace(/_/g, ' ')}`, await audit('status_change', 'project', id, { status }));
  });
}
