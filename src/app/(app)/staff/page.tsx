import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireFounder } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { Badge, Button, Select } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { ActionForm } from '@/components/action-form';
import { InviteStaffDialog } from '@/components/forms';
import { inviteStaff, updateStaffMember, deleteStaffMember } from '@/actions/staff';
import { Activity, ArrowUpRight, BriefcaseBusiness, CheckCircle2, Clock3, Mail, ShieldCheck, Target, Users2, UserRoundPlus } from 'lucide-react';

export const metadata: Metadata = { title: 'Staff', description: 'Manage your Vector Codes team and monitor staff activity.' };
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
  const team = list.filter((person) => person.role !== 'founder');
  const active = team.filter((person) => person.is_active);
  const pending = team.filter((person) => !person.is_active);
  const stat = (id: string) => {
    const assignedTasks = (tasks ?? []).filter((task) => task.assigned_to === id);
    const open = assignedTasks.filter((task) => task.status === 'todo' || task.status === 'in_progress');
    return {
      open: open.length,
      inProgress: assignedTasks.filter((task) => task.status === 'in_progress').length,
      overdue: open.filter((task) => task.due_at && task.due_at < nowIso).length,
      done: assignedTasks.filter((task) => task.status === 'done').length,
      won: (deals ?? []).filter((deal) => deal.assigned_to === id && deal.status === 'won').length,
      pipeline: (deals ?? []).filter((deal) => deal.assigned_to === id && !['won', 'lost'].includes(deal.status)).length,
      outreach: (outreach ?? []).filter((item) => item.created_by === id).length,
      last: (logs ?? []).find((log) => log.actor_id === id)?.created_at ?? null
    };
  };

  return (
    <>
      <PageHeader title="Team & staff" description="Manage your people, access and day-to-day performance.">
        <InviteStaffDialog action={inviteStaff} />
      </PageHeader>

      <section className="mb-6 overflow-hidden rounded-xl border border-line bg-[radial-gradient(ellipse_at_top_right,rgba(212,175,55,0.13),transparent_52%),linear-gradient(135deg,#151515,#0c0c0c)] p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" /> Vector Codes · People
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">
              {team.length > 0 ? 'Your team is taking shape.' : 'Build your team with confidence.'}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
              {team.length > 0
                ? 'Your first teammate is on the board. Keep work visible, assign clear ownership and track progress from one place.'
                : 'Invite trusted people, activate access when you are ready, and keep every responsibility accountable.'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-lg border border-white/10 bg-black/25 px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold"><Users2 size={19} /></div>
            <div><p className="text-2xl font-semibold tabular-nums text-text">{team.length}</p><p className="text-[10px] uppercase tracking-wider text-muted">Team members</p></div>
          </div>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric icon={<Users2 size={17} />} label="Total team" value={team.length} note="Staff and admins" />
        <Metric icon={<ShieldCheck size={17} />} label="Active members" value={active.length} note="Can access Vector Control" tone="green" />
        <Metric icon={<Clock3 size={17} />} label="Awaiting activation" value={pending.length} note="Access currently disabled" tone={pending.length ? 'gold' : 'default'} />
        <Metric icon={<CheckCircle2 size={17} />} label="Tasks completed" value={(tasks ?? []).filter((task) => task.status === 'done' && team.some((person) => person.id === task.assigned_to)).length} note="Across the whole team" />
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><h3 className="text-sm font-semibold text-text">Team workspace</h3><p className="mt-1 text-xs text-muted">A quick view of workload and sales activity.</p></div>
            <Badge tone="gold">Live records</Badge>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <MiniMetric label="Open tasks" value={(tasks ?? []).filter((task) => ['todo', 'in_progress'].includes(task.status) && team.some((person) => person.id === task.assigned_to)).length} />
            <MiniMetric label="Deals won" value={(deals ?? []).filter((deal) => deal.status === 'won' && team.some((person) => person.id === deal.assigned_to)).length} />
            <MiniMetric label="Outreach" value={(outreach ?? []).filter((item) => team.some((person) => person.id === item.created_by)).length} />
          </div>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold"><Target size={17} /></div>
            <div><h3 className="text-sm font-semibold text-text">Founder control</h3><p className="mt-1 text-xs leading-5 text-muted">Only you can invite, activate, change access levels or remove team accounts. Staff access stays inactive until you approve it here.</p></div>
          </div>
        </div>
      </section>

      <section className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h3 className="text-base font-semibold text-text">Your people</h3><p className="mt-1 text-xs text-muted">Individual access, responsibilities and performance.</p></div>
        <span className="text-xs text-muted">{active.length} active · {pending.length} awaiting activation</span>
      </section>

      {team.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-surface px-5 py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10 text-gold"><UserRoundPlus size={22} /></div>
          <h3 className="text-sm font-semibold text-text">Your first team member starts here</h3>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-muted">Invite a trusted teammate. You can activate their account and assign responsibilities once they are ready.</p>
          <div className="mt-4"><InviteStaffDialog action={inviteStaff} /></div>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {team.map((person) => {
            const stats = stat(person.id);
            const initials = (person.full_name || person.email || 'VC').split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
            return (
              <article key={person.id} className="overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-gold/30">
                <div className="flex flex-col gap-4 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-sm font-semibold text-gold">{initials || 'VC'}</div>
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-semibold text-text">{person.full_name || 'Team member'}</h4>
                        <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted"><Mail size={12} />{person.email || 'No email on profile'}</p>
                        <p className="mt-1 text-[10px] text-muted">Joined {formatDate(person.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Badge tone={person.is_active ? 'green' : 'gold'}>{person.is_active ? 'Active' : 'Inactive'}</Badge>
                      <Badge tone={person.role === 'admin' ? 'gold' : 'neutral'}>{person.role}</Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-lg border border-line bg-surface-2/60 p-3">
                    <Kpi label="Open tasks" value={stats.open} />
                    <Kpi label="Completed" value={stats.done} />
                    <Kpi label="Deals won" value={stats.won} />
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div><p className="text-muted">In progress</p><p className="mt-1 font-semibold tabular-nums text-text">{stats.inProgress}</p></div>
                    <div><p className="text-muted">Overdue</p><p className={stats.overdue ? 'mt-1 font-semibold tabular-nums text-danger' : 'mt-1 font-semibold tabular-nums text-text'}>{stats.overdue}</p></div>
                    <div><p className="text-muted">Outreach logged</p><p className="mt-1 font-semibold tabular-nums text-text">{stats.outreach}</p></div>
                  </div>

                  <div className="flex items-center justify-between border-t border-line pt-3 text-[11px] text-muted">
                    <span className="flex items-center gap-1.5"><Activity size={13} /> Last activity</span>
                    <span>{stats.last ? formatDate(stats.last) : 'No activity yet'}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-line bg-surface-2/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <ActionForm action={updateStaffMember} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={person.id} />
                    <Select name="role" aria-label={`Role for ${person.full_name || person.email}`} defaultValue={person.role} className="min-h-9 !py-1 text-xs">
                      <option value="staff">Staff</option><option value="admin">Admin</option>
                    </Select>
                    <Button type="submit" variant="subtle" size="sm">Save role</Button>
                  </ActionForm>
                  <div className="flex flex-wrap items-center gap-2">
                    <ActionForm action={updateStaffMember} confirm={person.is_active ? { title: `Deactivate ${person.full_name || person.email}?`, description: 'They will lose access to Vector Control until you reactivate them.', confirmLabel: 'Deactivate', danger: true } : undefined}>
                      <input type="hidden" name="id" value={person.id} />
                      <input type="hidden" name="is_active" value={String(!person.is_active)} />
                      <Button type="submit" variant={person.is_active ? 'danger' : 'primary'} size="sm">{person.is_active ? 'Deactivate' : 'Activate access'}</Button>
                    </ActionForm>
                    <ActionForm action={deleteStaffMember} confirm={{ title: 'Remove ' + (person.full_name || person.email) + '?', description: 'This permanently removes their login. Existing business records are retained, but their staff assignments will be cleared.', confirmLabel: 'Remove member', danger: true }}>
                      <input type="hidden" name="id" value={person.id} />
                      <Button type="submit" variant="ghost" size="sm">Remove</Button>
                    </ActionForm>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

function Metric({ icon, label, value, note, tone = 'default' }: { icon: React.ReactNode; label: string; value: number; note: string; tone?: 'default' | 'green' | 'gold' }) {
  const color = tone === 'green' ? 'text-emerald-400 bg-emerald-400/10' : tone === 'gold' ? 'text-gold bg-gold/10' : 'text-muted bg-surface-2';
  return <div className="rounded-xl border border-line bg-surface p-4"><div className="flex items-center justify-between gap-2"><span className="text-xs text-muted">{label}</span><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>{icon}</span></div><p className="mt-3 text-2xl font-semibold tabular-nums text-text">{value}</p><p className="mt-1 text-[10px] text-muted">{note}</p></div>;
}
function MiniMetric({ label, value }: { label: string; value: number }) { return <div><p className="text-[10px] uppercase tracking-wider text-muted">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums text-text">{value}</p></div>; }
function Kpi({ label, value }: { label: string; value: number }) { return <div><p className="text-[10px] text-muted">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums text-text">{value}</p></div>; }
