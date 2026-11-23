'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { runAction } from './helpers';

function clean(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim().slice(0, 200);
  const body = String(formData.get('body') ?? '').slice(0, 20000);
  if (!title && !body.trim()) throw new Error('Write a title or some text first');
  return { title, body, shared: formData.get('shared') === 'on', pinned: formData.get('pinned') === 'on' };
}

/** Create or edit a note. Only the owner can edit (enforced by row-level security). */
export async function saveNote(formData: FormData) {
  return runAction(async (profile) => {
    const values = clean(formData);
    const id = String(formData.get('id') ?? '').trim();
    const supabase = await createClient();
    if (id) {
      const { data, error } = await supabase.from('notes').update(values).eq('id', id).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('You can only edit your own notes');
      revalidatePath('/notes');
      return 'Note updated';
    }
    const { error } = await supabase.from('notes').insert({ ...values, owner_id: profile.id });
    if (error) throw error;
    revalidatePath('/notes');
    return 'Note saved';
  });
}

export async function toggleNotePin(formData: FormData) {
  return runAction(async () => {
    const id = String(formData.get('id') ?? '').trim();
    const pinned = formData.get('pinned') === 'true';
    if (!id) throw new Error('Note is missing');
    const supabase = await createClient();
    const { data, error } = await supabase.from('notes').update({ pinned }).eq('id', id).select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('You can only pin your own notes');
    revalidatePath('/notes');
    return pinned ? 'Pinned to the top' : 'Unpinned';
  });
}

/** Owner can delete their notes; the founder can remove any shared note. */
export async function deleteNote(formData: FormData) {
  return runAction(async () => {
    const id = String(formData.get('id') ?? '').trim();
    if (!id) throw new Error('Note is missing');
    const supabase = await createClient();
    const { data, error } = await supabase.from('notes').delete().eq('id', id).select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('You cannot delete this note');
    revalidatePath('/notes');
    return 'Note deleted';
  });
}
