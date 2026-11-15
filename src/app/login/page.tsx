import Link from 'next/link';
import { login, requestPasswordReset } from '@/actions/auth';
import { SubmitButton } from '@/components/submit-button';
import { Card, Field, Input } from '@/components/ui';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const { error, message } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gold font-bold text-black">V</div>
          <div>
            <h1 className="text-lg font-semibold">Vector Control</h1>
            <p className="text-xs uppercase tracking-widest text-muted">Vector Codes · Internal System</p>
          </div>
        </div>

        {error ? <p className="mb-4 rounded-md border border-red-900 bg-red-950/30 px-3 py-2 text-xs text-red-400">{error}</p> : null}
        {message ? <p className="mb-4 rounded-md border border-line bg-surface-2 px-3 py-2 text-xs text-muted">{message}</p> : null}

        <form action={login} className="space-y-4">
          <Field label="Email">
            <Input name="email" type="email" required autoComplete="email" placeholder="you@vectorcodes.com" />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" required autoComplete="current-password" />
          </Field>
          <SubmitButton className="w-full">Sign in</SubmitButton>
        </form>

        <form action={requestPasswordReset} className="mt-6 border-t border-line pt-4">
          <p className="mb-2 text-xs text-muted">Forgot your password? Enter your email to receive a reset link.</p>
          <div className="flex gap-2">
            <Input name="email" type="email" required placeholder="Email address" />
            <SubmitButton variant="ghost">Send</SubmitButton>
          </div>
          <p className="mt-4 text-[11px] text-muted/60">
            Private system. Access is restricted to authorized Vector Codes personnel.
          </p>
          <Link href="/login" className="mt-2 block text-[11px] text-gold/70">Back to sign in</Link>
        </form>
      </Card>
    </main>
  );
}
