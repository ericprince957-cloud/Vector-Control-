'use client';

import { useFormStatus } from 'react-dom';
import { Button } from './ui';

export function SubmitButton({ children, variant, className }: { children: React.ReactNode; variant?: 'primary' | 'ghost' | 'danger'; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant={variant} className={className}>
      {pending ? 'Saving…' : children}
    </Button>
  );
}
