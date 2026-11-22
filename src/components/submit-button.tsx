'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { Button } from './ui';

/**
 * Submit button. Used both with plain <form action> (login) and inside
 * ActionForm (which disables its fieldset while pending).
 */
export function SubmitButton({ children, variant, size, className, pendingLabel = 'Saving…' }: {
  children: React.ReactNode;
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle';
  size?: 'md' | 'sm';
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant={variant} size={size} className={className}>
      {pending ? <><Loader2 size={14} className="animate-spin" aria-hidden /> {pendingLabel}</> : children}
    </Button>
  );
}

/** Submit button for ActionForm, where pending state comes from the wrapping fieldset. */
export function FormSubmit({ children, variant, size, className }: {
  children: React.ReactNode;
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle';
  size?: 'md' | 'sm';
  className?: string;
}) {
  return <Button type="submit" variant={variant} size={size} className={className}>{children}</Button>;
}
