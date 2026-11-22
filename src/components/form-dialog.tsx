'use client';

import { useState, type ReactNode } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { Dialog } from './dialog';
import { ActionForm } from './action-form';
import { Button } from './ui';
import type { ActionState } from '@/lib/validators';

/**
 * Button that opens a modal form. The modal closes only when the backend
 * reports success; validation / permission errors keep the form open with
 * the user's input intact.
 */
export function FormDialog({
  title,
  description,
  triggerLabel,
  triggerVariant = 'primary',
  triggerSize = 'md',
  icon = 'plus',
  action,
  submitLabel = 'Save',
  size = 'md',
  children
}: {
  title: string;
  description?: string;
  triggerLabel: string;
  triggerVariant?: 'primary' | 'ghost' | 'subtle' | 'danger';
  triggerSize?: 'md' | 'sm';
  icon?: 'plus' | 'edit' | 'none';
  action: (formData: FormData) => Promise<ActionState>;
  submitLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={triggerVariant} size={triggerSize} onClick={() => setOpen(true)}>
        {icon === 'plus' ? <Plus size={15} aria-hidden /> : icon === 'edit' ? <Pencil size={13} aria-hidden /> : null}
        {triggerLabel}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title} description={description} size={size}>
        <ActionForm action={action} className="space-y-5" onSuccess={() => setOpen(false)}>
          {children}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">{submitLabel}</Button>
          </div>
        </ActionForm>
      </Dialog>
    </>
  );
}
