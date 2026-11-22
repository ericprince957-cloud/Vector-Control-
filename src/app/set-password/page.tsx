import type { Metadata } from 'next';
import { updatePassword } from '@/actions/auth';
import { AuthFrame } from '@/components/auth-frame';
import { SubmitButton } from '@/components/submit-button';
import { Field, Input, Notice } from '@/components/ui';

export const metadata: Metadata = { title: 'Create your password' };

export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthFrame title="Create your password" subtitle="Welcome to Vector Control. Choose a secure password to finish setting up your staff account.">
      <div className="space-y-4">
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <form action={updatePassword} className="space-y-4">
          <Field label="Create password"><Input name="password" type="password" required minLength={8} autoComplete="new-password" /></Field>
          <Field label="Confirm password"><Input name="confirm" type="password" required minLength={8} autoComplete="new-password" /></Field>
          <p className="text-xs text-muted">After creating your password, your account will remain inactive until the founder activates it.</p>
          <SubmitButton className="w-full" pendingLabel="Saving password…">Create password</SubmitButton>
        </form>
      </div>
    </AuthFrame>
  );
}
