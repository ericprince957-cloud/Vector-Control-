import type { Metadata } from 'next';
import { login, requestPasswordReset } from '@/actions/auth';
import { AuthFrame } from '@/components/auth-frame';
import { SubmitButton } from '@/components/submit-button';
import { Field, Input, Notice } from '@/components/ui';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const { error, message } = await searchParams;

  return (
    <AuthFrame title="Sign in" subtitle="Use your Vector Codes staff account.">
      <div className="space-y-4">
        {error ? <Notice tone="danger">{error}</Notice> : null}
        {message ? <Notice>{message}</Notice> : null}

        <form action={login} className="space-y-4">
          <Field label="Email"><Input name="email" type="email" required autoComplete="email" placeholder="you@vectorcodes.com" /></Field>
          <Field label="Password"><Input name="password" type="password" required autoComplete="current-password" /></Field>
          <SubmitButton className="w-full" pendingLabel="Signing in…">Sign in</SubmitButton>
        </form>

        <form action={requestPasswordReset} className="border-t border-line pt-4">
          <p className="mb-2 text-xs text-muted">Forgot your password? We will email you a reset link.</p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="reset-email" className="sr-only">Email address</label>
              <Input id="reset-email" name="email" type="email" required placeholder="Email address" autoComplete="email" />
            </div>
            <SubmitButton variant="ghost" pendingLabel="Sending…">Send link</SubmitButton>
          </div>
        </form>
      </div>
    </AuthFrame>
  );
}
