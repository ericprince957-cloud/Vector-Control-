'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Toast = { id: number; ok: boolean; message: string };
type ToastApi = { notify: (ok: boolean, message: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

let counter = 0;

/**
 * Toasts only ever display the real result returned by a server action —
 * there is no code path that reports success without a backend response.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const notify = useCallback((ok: boolean, message: string) => {
    const id = ++counter;
    setToasts((t) => [...t.slice(-3), { id, ok, message }]);
    setTimeout(() => dismiss(id), ok ? 5000 : 9000);
  }, [dismiss]);

  const api = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.ok ? 'status' : 'alert'}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[6px] border bg-surface-2 px-4 py-3 text-sm shadow-lg shadow-black/50',
              t.ok ? 'border-emerald-800' : 'border-red-900'
            )}
          >
            {t.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" /> : <AlertCircle size={16} className="mt-0.5 shrink-0 text-danger" />}
            <p className="min-w-0 flex-1 break-words">{t.message}</p>
            <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(t.id)} className="text-muted hover:text-text">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  // Outside the provider (e.g. login page) notifications are simply skipped.
  return ctx ?? { notify: () => undefined };
}
