import { updatePassword } from '@/actions/auth';
import { SubmitButton } from '@/components/submit-button';
import { Card, Field, Input } from '@/components/ui';

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md p-8">
        <h1 className="mb-1 text-lg font-semibold">Set a new password</h1>
        <p className="mb-6 text-xs text-muted">Choose a strong password of at least 8 characters.</p>
        {error ? <p className="mb-4 rounded-md border border-red-900 bg-red-950/30 px-3 py-2 text-xs text-red-400">{error}</p> : null}
        <form action={updatePassword} className="space-y-4">
          <Field label="New password">
            <Input name="password" type="password" required minLength={8} />
          </Field>
          <Field label="Confirm password">
            <Input name="confirm" type="password" required minLength={8} />
          </Field>
          <SubmitButton className="w-full">Update password</SubmitButton>
        </form>
      </Card>
    </main>
  );
}
