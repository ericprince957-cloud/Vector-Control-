import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireFounder } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { Card, CardHeader, StatCard, Table, TH, TD, Badge, Select, Button, EmptyState } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { ActionForm } from '@/components/action-form';
import { InviteStaffDialog } from '@/components/forms';
import { inviteStaff, updateStaffMember } from '@/actions/staff';

export const metadata: Metadata = { title: 'Staff', description: 'Team accounts and access.' };
export const dynamic = 'force-dynamic';

export default async function StaffPage() {
  const me = await requireFounder();
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [{ data: staff }, { data: tasks }, { data: deals }, { data: outreach }, { data: logs }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at'),
    supabase.from('tasks').select('assigned_to, status, due_at'),
    supabase.from('deals').select('assigned_to, status'),
    supabase.from('outreach_activities').select('created_by'),
    supabase.from('audit_logs').select('actor_id, created_at').order('created_at', { ascending: false }).limit(500)
  ]);

  const list = staff ?? [];
  const stat = (id: string) => {
    const t = (tasks ?? []).filter((x) => x.assigned_to === id);
    const open = t.filter((x) => x.status === 'todo' || x.status === 'in_progress');
    return {
      open: open.length,
      overdue: open.filter((x) => x.due_at && x.due_at < nowIso).length,
      done: t.filter((x) => x.status === 'done').length,
      won: (deals ?? []).filter((d) => d.assigned_to === id && d.status === 'won').length,
      outreach: (outreach ?? []).filter((o) => o.created_by === id).length,
      last: (logs ?? []).find((l) => l.actor_id === id)?.created_at ?? null
    };
  };

  return (
    <>
      <PageHeader title="Staff" description="Founder-only. Invited accounts start inactive and must be activated here.">
        <InviteStaffDialog action={inviteStaff} />
      </PageHeader>

      <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Accounts" value={list.length} />
        <StatCard label="Active" value={list.filter((s) => s.is_active).length} tone="green" />
        <StatCard label="Awaiting activation" value={list.filter((s) => !s.is_active).length} tone={list.some((s) => !s.is_active) ? 'gold' : undefined} />
      </section>

      <Card>
        <CardHeader title="Team" subtitle="Performance counts come from live records" />
        {!list.length ? <EmptyState title="No staff accounts" /> : (
          <Table minWidth={980}>
            <thead><tr><TH>Name</TH><TH>Role</TH><TH>Status</TH><TH>Open tasks</TH><TH>Overdue</TH><TH>Deals won</TH><TH>Outreach</TH><TH>Last activity</TH><TH>Manage</TH></tr></thead>
            <tbody>
              {list.map((s) => {
                const st = stat(s.id);
                const self = s.id === me.id;
                return (
                  <tr key={s.id} className="hover:bg-surface-2/60">
                    <TD><p className="font-medium">{s.full_name || '—'}{self ? <span className="ml-2 text-xs text-gold">(you)</span> : null}</p><p className="text-xs text-muted">{s.email}</p></TD>
                    <TD><Badge tone={s.role === 'founder' ? 'gold' : 'neutral'}>{s.role}</Badge></TD>
                    <TD><Badge tone={s.is_active ? 'green' : 'red'}>{s.is_active ? 'Active' : 'Inactive'}</Badge></TD>
                    <TD>{st.open}</TD>
                    <TD className={st.overdue ? 'text-danger' : ''}>{st.overdue}</TD>
                    <TD>{st.won}</TD>
                    <TD>{st.outreach}</TD>
                    <TD className="whitespace-nowrap text-xs text-muted">{formatDate(st.last)}</TD>
                    <TD>
                      {self ? <span className="text-xs text-muted">Protected</span> : (
                        <div className="flex flex-wrap items-center gap-2">
                          <ActionForm action={updateStaffMember} className="flex items-center gap-1">
                            <input type="hidden" name="id" value={s.id} />
                            <Select name="role" aria-label={`Role for ${s.full_name || s.email}`} defaultValue={s.role === 'founder' ? 'admin' : s.role} className="min-h-8 !py-1 text-xs">
                              <option value="staff">staff</option>
                              <option value="admin">admin</option>
                            </Select>
                            <Button type="submit" variant="subtle" size="sm">Save role</Button>
                          </ActionForm>
                          <ActionForm
                            action={updateStaffMember}
                            confirm={s.is_active ? { title: `Deactivate ${s.full_name || s.email}?`, description: 'They will lose access to the system until reactivated.', confirmLabel: 'Deactivate', danger: true } : undefined}
                          >
                            <input type="hidden" name="id" value={s.id} />
                            <input type="hidden" name="is_active" value={String(!s.is_active)} />
                            <Button type="submit" variant={s.is_active ? 'danger' : 'primary'} size="sm">{s.is_active ? 'Deactivate' : 'Activate'}</Button>
                          </ActionForm>
                        </div>
                      )}
                    </TD>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
