'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { taskSchema, parseOrError } from '@/lib/validators';
import { runAction, audit, blankToNull, withAuditWarning } from './helpers';

export async function saveTask(formData: FormData) {
  return runAction(async (profile) => {
    const { data, error } = parseOrError(taskSchema, formData);
    if (error) throw new Error(error);
    const supabase = await createClient();
    const values = {
      title: data.title,
      description: data.description ?? '',
      status: data.status,
      priority: data.priority,
      due_at: blankToNull(data.due_at as string),
      assigned_to: blankToNull(data.assigned_to) ?? profile.id,
      prospect_id: blankToNull(data.prospect_id),
      deal_id: blankToNull(data.deal_id),
      project_id: blankToNull(data.project_id),
      completed_at: data.status === 'done' ? new Date().toISOString() : null
    };
    const id = blankToNull(formData.get('id'));
    if (id) {
      const { error: upErr } = await supabase.from('tasks').update(values).eq('id', id);
      if (upErr) throw upErr;
      revalidatePath('/tasks');
      revalidatePath('/overview');
      return 'Task updated';
    }
    const { error: inErr } = await supabase.from('tasks').insert({ ...values, created_by: profile.id });
    if (inErr) throw inErr;
    revalidatePath('/tasks');
    revalidatePath('/overview');
    return withAuditWarning('Task created', await audit('create', 'task', null, { title: data.title }));
  });
}

export async function updateTaskStatus(formData: FormData) {
  return runAction(async () => {
    const supabase = await createClient();
    const id = String(formData.get('id'));
    const status = String(formData.get('status'));
    const { error } = await supabase
      .from('tasks')
      .update({ status, completed_at: status === 'done' ? new Date().toISOString() : null })
      .eq('id', id);
    if (error) throw error;
    revalidatePath('/tasks');
    revalidatePath('/overview');
    return `Task marked ${status.replace('_', ' ')}`;
  });
}
