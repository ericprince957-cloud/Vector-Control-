'use client';

import { FormDialog } from './form-dialog';
import { Field, Input, Textarea } from './ui';
import type { ActionState } from '@/lib/validators';

export type NoteRow = { id: string; title: string; body: string; shared: boolean; pinned: boolean };

export function NoteDialog({ action, note }: { action: (fd: FormData) => Promise<ActionState>; note?: NoteRow }) {
  const edit = Boolean(note);
  return (
    <FormDialog
      title={edit ? 'Edit note' : 'New note'}
      description="Notes are private to you unless you share them with the team."
      triggerLabel={edit ? 'Edit' : 'New note'}
      triggerVariant={edit ? 'subtle' : 'primary'}
      triggerSize={edit ? 'sm' : 'md'}
      icon={edit ? 'edit' : 'plus'}
      action={action}
      submitLabel={edit ? 'Save changes' : 'Save note'}
      size="lg"
    >
      {note ? <input type="hidden" name="id" value={note.id} /> : null}
      <div className="space-y-4">
        <Field label="Title"><Input name="title" maxLength={200} defaultValue={note?.title} placeholder="e.g. Call Mr. Precious Friday" /></Field>
        <Field label="Note"><Textarea name="body" rows={10} maxLength={20000} defaultValue={note?.body} placeholder="Write anything you don’t want to forget…" /></Field>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <label className="inline-flex items-center gap-2"><input type="checkbox" name="pinned" defaultChecked={note?.pinned} className="h-4 w-4 accent-[#D4AF37]" /> Pin to top</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" name="shared" defaultChecked={note?.shared} className="h-4 w-4 accent-[#D4AF37]" /> Share with the whole team</label>
        </div>
      </div>
    </FormDialog>
  );
}
