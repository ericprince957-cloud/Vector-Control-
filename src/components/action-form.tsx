'use client';

import { useActionState, type ReactNode } from 'react';
import type { ActionState } from '@/lib/validators';

export function ActionForm({
  action,
  children,
  className
}: {
  action: (formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(
    async (_previous: ActionState, formData: FormData) => action(formData),
    { ok: true, message: '' }
  );

  return (
    <form action={formAction} className={className}>
      {children}
      {state.message ? (
        <p className={`mt-2 text-xs ${state.ok ? 'text-emerald-500' : 'text-red-400'}`} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
