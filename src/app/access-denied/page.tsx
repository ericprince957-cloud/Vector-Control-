import type { Metadata } from 'next';
import { logout } from '@/actions/auth';
import { AuthFrame } from '@/components/auth-frame';
import { SubmitButton } from '@/components/submit-button';

export const metadata: Metadata = { title: 'Access restricted' };

export default async function AccessDeniedPage() {
  return (
    <AuthFrame title="Account not activated">
      <p className="text-sm text-muted">
        You are signed in, but this account has not been activated by the founder of Vector Codes. Contact the founder to request access.
      </p>
      <form action={logout} className="mt-6">
        <SubmitButton variant="ghost" pendingLabel="Signing out…">Sign out</SubmitButton>
      </form>
    </AuthFrame>
  );
}
