'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { taskSchema, parseOrError } from '@/lib/validators';
import { runAction, audit, blankToNull } from './helpers';

export async function saveTask(formData: FormData) {
  return runAction(async (profile) => {
    const { data, error } = parseOrError(taskSchema, formData);
    if (error) throw new Error(error);
    const supabase = await createClient();
    const values = {
      title: data.title,
      description: data.description ?? '',
      assigned_to: blankToNull(data.assigned_to) ?? profile.id,
      due_date: blankToNull(data.due_date as string),
      priority: data.priority,
      prospect_id: blankToNull(data.prospect_id),
      deal_id: blankToNull(data.deal_id),
      created_by: profile.id
    };
    const id = blankToNull(formData.get('id'));
    if (id) {
      const { error: upErr } = await supabase.from('tasks').update(values).eq('id', id);
      if (upErr) throw upErr;
      revalidatePath('/tasks');
      return 'Task updated';
    }
    const { error: inErr } = await supabase.from('tasks').insert(values);
    if (inErr) throw inErr;
    revalidatePath('/tasks');
    revalidatePath('/overview');
    return 'Task created';
  });
}

export async function toggleTask(formData: FormData) {
  return runAction(async () => {
    const supabase = await createClient();
    const id = String(formData.get('id'));
    const done = String(formData.get('done')) === 'true';
    const { error } = await supabase
      .from('tasks')
      .update({ is_completed: done, completed_at: done ? new Date().toISOString() : null })
      .eq('id', id);
    if (error) throw error;
    revalidatePath('/tasks');
    revalidatePath('/overview');
    return done ? 'Task completed' : 'Task reopened';
  });
}

export async function deleteTask(formData: FormData) {
  return runAction(async () => {
    const supabase = await createClient();
    const id = String(formData.get('id'));
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/tasks');
    return 'Task deleted';
  });
}
