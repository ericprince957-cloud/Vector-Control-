import type { Metadata } from 'next';
import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { Card, CardHeader, Badge, Button, DetailRow, LinkButton } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { logout } from '@/actions/auth';
import { InstallApp } from '@/components/pwa';

export const metadata: Metadata = { title: 'Settings', description: 'Account and workspace information.' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const profile = await requireProfile();
  const isFounder = profile.role === 'founder';
  return (
    <>
      <PageHeader title="Settings" description="Your account and workspace information." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Your account" />
          <dl className="px-4 py-1">
            <DetailRow label="Name">{profile.full_name || '—'}</DetailRow>
            <DetailRow label="Email">{profile.email}</DetailRow>
            <DetailRow label="Role"><Badge tone={isFounder ? 'gold' : 'neutral'}>{profile.role}</Badge></DetailRow>
          </dl>
          <div className="flex flex-wrap gap-2 border-t border-line p-4">
            <LinkButton href="/reset-password" variant="ghost">Change password</LinkButton>
            <form action={logout}><Button type="submit" variant="danger">Sign out</Button></form>
          </div>
        </Card>

        <Card>
          <CardHeader title="Workspace" subtitle="Vector Control · Vector Codes" />
          <dl className="px-4 py-1">
            <DetailRow label="Currency">Nigerian Naira (₦)</DetailRow>
            <DetailRow label="Revenue rule">Successful payments only, net of refunds</DetailRow>
            <DetailRow label="Commission rate">10% of eligible received payments</DetailRow>
            <DetailRow label="Data security">Supabase Auth with row-level security</DetailRow>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Install app" subtitle="Use Vector Control like a native app" />
          <div className="p-4"><InstallApp /></div>
        </Card>

        <Card>
          <CardHeader title="Security & access" />
          <div className="space-y-2 px-4 py-4 text-sm text-muted">
            <p>Access is enforced by the database: staff only see records permitted to their role, whatever the screen shows.</p>
            <p>Pricing approval, won/lost decisions, project creation and commission approval are founder-only actions.</p>
            {isFounder ? (
              <p className="pt-1">
                Founder tools: <Link href="/staff" className="text-gold hover:underline">manage staff</Link> · <Link href="/audit" className="text-gold hover:underline">view audit log</Link>
              </p>
            ) : null}
          </div>
        </Card>
      </div>
    </>
  );
}
