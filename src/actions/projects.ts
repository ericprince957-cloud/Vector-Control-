'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { projectSchema, parseOrError } from '@/lib/validators';
import { runAction, audit, blankToNull } from './helpers';

export async function saveProject(formData: FormData) {
  return runAction(async () => {
    const { data, error } = parseOrError(projectSchema, formData);
    if (error) throw new Error(error);
    const supabase = await createClient();

    const values = {
      name: data.name,
      client_name: data.client_name ?? '',
      deal_id: blankToNull(data.deal_id),
      description: data.description ?? '',
      contract_amount: data.contract_amount,
      start_date: blankToNull(data.start_date as string),
      deadline: blankToNull(data.deadline as string),
      assigned_to: blankToNull(data.assigned_to),
      status: data.status,
      progress_notes: data.progress_notes ?? '',
      completed_at: data.status === 'completed' ? new Date().toISOString() : null
    };

    const id = blankToNull(formData.get('id'));
    if (id) {
      const { error: upErr } = await supabase.from('projects').update(values).eq('id', id);
      if (upErr) throw upErr;
      await audit('update', 'project', id, { status: data.status });
      revalidatePath('/projects');
      return 'Project updated';
    }

    const { data: created, error: inErr } = await supabase.from('projects').insert(values).select('id').single();
    if (inErr) throw inErr;
    await audit('create', 'project', created.id, { name: data.name });
    revalidatePath('/projects');
    return 'Project created';
  });
}

export async function deleteProject(formData: FormData) {
  return runAction(async () => {
    const supabase = await createClient();
    const id = String(formData.get('id'));
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/projects');
    return 'Project deleted';
  });
}
