import type { Metadata } from 'next';
import { updatePassword } from '@/actions/auth';
import { AuthFrame } from '@/components/auth-frame';
import { SubmitButton } from '@/components/submit-button';
import { Field, Input, Notice } from '@/components/ui';

export const metadata: Metadata = { title: 'Set a new password' };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthFrame title="Set a new password" subtitle="Choose a strong password of at least 8 characters.">
      <div className="space-y-4">
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <form action={updatePassword} className="space-y-4">
          <Field label="New password"><Input name="password" type="password" required minLength={8} autoComplete="new-password" /></Field>
          <Field label="Confirm password"><Input name="confirm" type="password" required minLength={8} autoComplete="new-password" /></Field>
          <SubmitButton className="w-full" pendingLabel="Updating…">Update password</SubmitButton>
        </form>
      </div>
    </AuthFrame>
  );
}
