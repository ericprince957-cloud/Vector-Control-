'use client';

import { useRef, useState, useTransition, type ReactNode } from 'react';
import { Dialog } from './dialog';
import { Button } from './ui';
import { useToast } from './toast';
import type { ActionState } from '@/lib/validators';

export type ConfirmOptions = { title: string; description: string; confirmLabel?: string; danger?: boolean };

/**
 * Wraps a server action in a form.
 *
 * - Submits via onSubmit (not the form `action` prop) so React 19 does not
 *   wipe the user's input when the server rejects it.
 * - Shows the real server response as a toast and an inline message.
 * - Optionally asks for confirmation first (destructive / irreversible actions).
 */
export function ActionForm({
  action,
  children,
  className,
  confirm,
  resetOnSuccess = false,
  onSuccess,
  silent = false
}: {
  action: (formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  confirm?: ConfirmOptions;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
  /** Skip the toast (inline message still shown). */
  silent?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);
  const [asking, setAsking] = useState(false);
  const { notify } = useToast();

  function run(form: HTMLFormElement) {
    const data = new FormData(form);
    startTransition(async () => {
      let res: ActionState;
      try {
        res = await action(data);
      } catch {
        res = { ok: false, message: 'The request failed. Check your connection and try again.' };
      }
      setResult(res);
      if (!silent) notify(res.ok, res.message);
      if (res.ok) {
        if (resetOnSuccess) form.reset();
        onSuccess?.();
      }
    });
  }

  return (
    <>
      <form
        ref={formRef}
        className={className}
        aria-busy={pending}
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return;
          if (confirm) setAsking(true);
          else run(e.currentTarget);
        }}
      >
        <fieldset disabled={pending} className="contents">{children}</fieldset>
        {result && !result.ok ? (
          <p role="alert" className="mt-2 text-xs text-danger">{result.message}</p>
        ) : null}
      </form>

      {confirm ? (
        <Dialog open={asking} onClose={() => setAsking(false)} title={confirm.title} size="sm">
          <p className="text-sm text-muted">{confirm.description}</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAsking(false)}>Cancel</Button>
            <Button
              variant={confirm.danger === false ? 'primary' : 'danger'}
              onClick={() => {
                setAsking(false);
                if (formRef.current) run(formRef.current);
              }}
            >
              {confirm.confirmLabel ?? 'Confirm'}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
