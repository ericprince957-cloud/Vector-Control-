import { logout } from '@/actions/auth';
import { SubmitButton } from '@/components/submit-button';
import { Card } from '@/components/ui';

export default async function AccessDeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md border border-gold/40 text-gold">!</div>
        <h1 className="text-lg font-semibold">Account not activated</h1>
        <p className="mt-2 text-sm text-muted">
          You are signed in, but this account has not been activated by the founder of Vector Codes.
          Please contact the founder to request access.
        </p>
        <form action={logout} className="mt-6">
          <SubmitButton variant="ghost">Sign out</SubmitButton>
        </form>
      </Card>
    </main>
  );
}
