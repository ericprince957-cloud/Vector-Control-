import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card, CardHeader, Button, Badge } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { logout } from '@/actions/auth';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { count } = await supabase.from('prospects').select('id', { count: 'exact', head: true });

  return (
    <>
      <PageHeader title="Settings" description="Account and system configuration." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Your account" />
          <div className="space-y-2 p-5 text-sm">
            <div className="flex justify-between border-b border-line/50 pb-2"><span className="text-muted">Name</span><span>{profile.full_name || '—'}</span></div>
            <div className="flex justify-between border-b border-line/50 pb-2"><span className="text-muted">Email</span><span>{profile.email}</span></div>
            <div className="flex justify-between border-b border-line/50 pb-2"><span className="text-muted">Role</span><Badge tone={profile.role === 'founder' ? 'gold' : 'neutral'}>{profile.role}</Badge></div>
            <form action={logout} className="pt-3"><Button variant="ghost" type="submit">Sign out</Button></form>
          </div>
        </Card>

        <Card>
          <CardHeader title="System" subtitle="Vector Control · Vector Codes" />
          <div className="space-y-2 p-5 text-sm">
            <div className="flex justify-between border-b border-line/50 pb-2"><span className="text-muted">Currency</span><span>NGN (₦)</span></div>
            <div className="flex justify-between border-b border-line/50 pb-2"><span className="text-muted">Records in CRM</span><span>{count ?? 0}</span></div>
            <div className="flex justify-between border-b border-line/50 pb-2"><span className="text-muted">Data storage</span><span>Supabase PostgreSQL (RLS enforced)</span></div>
            <div className="flex justify-between border-b border-line/50 pb-2"><span className="text-muted">Supabase project</span><span className="text-xs">qbmvpmtcelztuzxyifcp</span></div>
            <div className="flex justify-between"><span className="text-muted">Version</span><span>0.2.0</span></div>
          </div>
        </Card>
      </div>
    </>
  );
}
