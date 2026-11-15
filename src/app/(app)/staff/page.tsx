import { createClient } from '@/lib/supabase/server';
import { requireFounder } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { Card, CardHeader, Table, TH, TD, Badge, Select, Button } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { InviteStaffForm } from '@/components/forms';
import { inviteStaff, updateStaffMember } from '@/actions/staff';
import { SubmitButton } from '@/components/submit-button';

export const dynamic = 'force-dynamic';

export default async function StaffPage() {
  const me = await requireFounder();
  const supabase = await createClient();

  const [{ data: staff }, { data: logs }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at'),
    supabase.from('audit_logs').select('*, actor:profiles!audit_logs_actor_id_fkey(full_name)').order('created_at', { ascending: false }).limit(30)
  ]);

  return (
    <>
      <PageHeader title="Staff management" description="Founder-only administration. Invited accounts start inactive and must be activated here." />
      <InviteStaffForm action={inviteStaff} />

      <Card className="mb-4">
        <CardHeader title="Staff members" subtitle={`${(staff ?? []).length} accounts`} />
        <Table>
          <thead><tr><TH>Name</TH><TH>Email</TH><TH>Role</TH><TH>Status</TH><TH>Joined</TH><TH>Manage</TH></tr></thead>
          <tbody>
            {(staff ?? []).map((s) => (
              <tr key={s.id}>
                <TD className="font-medium">{s.full_name || '—'}{s.id === me.id ? <span className="ml-2 text-xs text-gold">(you)</span> : null}</TD>
                <TD className="text-xs text-muted">{s.email}</TD>
                <TD><Badge tone={s.role === 'founder' ? 'gold' : 'neutral'}>{s.role}</Badge></TD>
                <TD><Badge tone={s.is_active ? 'green' : 'red'}>{s.is_active ? 'Active' : 'Inactive'}</Badge></TD>
                <TD className="text-xs">{formatDate(s.created_at)}</TD>
                <TD>
                  {s.id === me.id ? <span className="text-xs text-muted">Protected</span> : (
                    <form action={updateStaffMember} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={s.id} />
                      <Select name="role" defaultValue={s.role} className="!py-1 text-xs">
                        <option value="staff">staff</option>
                        <option value="admin">admin</option>
                      </Select>
                      <input type="hidden" name="is_active" value={String(!s.is_active)} />
                      <SubmitButton variant="ghost" className="!px-2 !py-1 text-xs">
                        {s.is_active ? 'Deactivate' : 'Activate'}
                      </SubmitButton>
                    </form>
                  )}
                </TD>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader title="Audit history" subtitle="Recent important changes" />
        <Table>
          <thead><tr><TH>When</TH><TH>Actor</TH><TH>Action</TH><TH>Entity</TH><TH>Details</TH></tr></thead>
          <tbody>
            {(logs ?? []).map((l) => (
              <tr key={l.id}>
                <TD className="text-xs">{formatDate(l.created_at)}</TD>
                <TD className="text-xs">{l.actor?.full_name ?? '—'}</TD>
                <TD className="capitalize">{l.action}</TD>
                <TD className="capitalize text-muted">{l.entity}</TD>
                <TD className="max-w-xs truncate text-xs text-muted">{JSON.stringify(l.details)}</TD>
              </tr>
            ))}
            {!(logs ?? []).length ? <tr><TD className="text-center text-muted">No audit entries yet</TD></tr> : null}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
