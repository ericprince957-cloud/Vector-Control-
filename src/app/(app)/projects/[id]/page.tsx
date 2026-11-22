import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatNGN, formatDate } from '@/lib/utils';
import { Card, CardHeader, Table, TH, TD, Badge, EmptyState, DetailRow, StatCard, Select, Button } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { ActionForm } from '@/components/action-form';
import { ProjectDialog, TaskDialog } from '@/components/forms';
import { deleteProject, saveProject } from '@/actions/projects';
import { saveTask, updateTaskStatus } from '@/actions/tasks';
import { assignRecord } from '@/actions/staff';
import { label, TASK_STATUSES } from '@/lib/constants';
import { projectTone, paymentTone, priorityTone, one, netAmount } from '@/lib/ui-helpers';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('projects').select('project_name').eq('id', id).maybeSingle();
  return { title: data?.project_name ?? 'Project' };
}

type Rel<T> = T | T[] | null;
type Client = { id: string; company_name: string; contact_name: string | null; email: string | null; phone: string | null };

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const isFounder = profile.role === 'founder';
  const isStaff = profile.role === 'staff';
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from('projects')
    .select('*, assigned:profiles!projects_assigned_to_fkey(full_name), deal:deals(id, title), prospect:prospects(id, company_name, contact_name, email, phone)')
    .eq('id', id)
    .maybeSingle();
  if (!project) notFound();

  const empty = Promise.resolve({ data: null as null });
  const [tasksRes, paymentsRes, activityRes, staffRes, dealsRes, prospectsRes] = await Promise.all([
    supabase.from('tasks').select('*, assignee:profiles!tasks_assigned_to_fkey(full_name)').eq('project_id', id).order('due_at', { ascending: true, nullsFirst: false }),
    !isStaff ? supabase.from('payments').select('id, amount, status, transaction_type, paid_at').eq('project_id', id).order('paid_at', { ascending: false }) : empty,
    supabase.from('audit_logs').select('id, action, created_at, actor:profiles!audit_logs_actor_id_fkey(full_name)').eq('entity_id', id).order('created_at', { ascending: false }).limit(10),
    supabase.from('profiles').select('id, full_name, email').eq('is_active', true),
    isFounder ? supabase.from('deals').select('id, title').eq('status', 'won') : empty,
    supabase.from('prospects').select('id, company_name').order('company_name')
  ]);

  const tasks = tasksRes.data ?? [];
  const payments = (paymentsRes.data ?? []) as { id: string; amount: number; status: string; transaction_type: string; paid_at: string }[];
  const activity = (activityRes.data ?? []) as unknown as { id: string; action: string; created_at: string; actor: Rel<{ full_name: string }> }[];
  const staff = (staffRes.data ?? []).map((s) => ({ id: s.id, name: s.full_name || s.email }));
  const dealOptions = ((dealsRes.data ?? []) as { id: string; title: string }[]).map((d) => ({ id: d.id, name: d.title }));
  const prospectOptions = (prospectsRes.data ?? []).map((p) => ({ id: p.id, name: p.company_name }));
  const client = one(project.prospect as Rel<Client>);
  const deal = one(project.deal as Rel<{ id: string; title: string }>);

  const counted = tasks.filter((t) => t.status !== 'cancelled');
  const done = counted.filter((t) => t.status === 'done').length;
  const pct = counted.length ? Math.round((done / counted.length) * 100) : null;
  const received = payments.reduce((s, p) => s + netAmount(p), 0);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = !['completed', 'cancelled'].includes(project.status) && project.due_date && project.due_date < today;

  return (
    <>
      <PageHeader back={{ href: '/projects', label: 'All projects' }} title={project.project_name} description={project.client_name ? `Client: ${project.client_name}` : undefined}>
        <Badge tone={projectTone[project.status]}>{label(project.status)}</Badge>
        {isFounder ? <ProjectDialog action={saveProject} deals={dealOptions} staff={staff} project={project} /> : null}
        {isFounder ? <ActionForm action={deleteProject} confirm={{ title: 'Permanently delete this project?', description: 'Tasks will be detached and payment ledger entries retained without a project link. This cannot be undone.', confirmLabel: 'Delete project' }}><input type="hidden" name="id" value={project.id} /><Button type="submit" variant="danger">Delete</Button></ActionForm> : null}
        <TaskDialog action={saveTask} staff={staff} prospects={prospectOptions} projects={[{ id: project.id, name: project.project_name }]} defaultProjectId={project.id} />
      </PageHeader>

      <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {!isStaff ? <StatCard label="Project value" value={formatNGN(project.contract_value)} tone="gold" /> : null}
        {!isStaff ? <StatCard label="Received" value={formatNGN(received)} tone="green" hint="Successful payments, net of refunds" /> : null}
        <StatCard label="Delivery progress" value={pct === null ? '—' : `${pct}%`} hint={pct === null ? 'No linked tasks yet' : `${done} of ${counted.length} tasks done`} />
        <StatCard label="Due date" value={formatDate(project.due_date)} tone={overdue ? 'red' : undefined} hint={overdue ? 'Past the due date' : undefined} />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Deliverables & milestones" subtitle="Tasks linked to this project" />
            {!tasks.length ? <EmptyState title="No tasks linked yet" hint="Create tasks for this project to track delivery." /> : (
              <Table minWidth={680}>
                <thead><tr><TH>Task</TH><TH>Assignee</TH><TH>Due</TH><TH>Priority</TH><TH>Status</TH></tr></thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id}>
                      <TD>{t.title}</TD>
                      <TD className="text-xs text-muted">{one(t.assignee as Rel<{ full_name: string }>)?.full_name ?? 'Unassigned'}</TD>
                      <TD className="whitespace-nowrap text-xs">{formatDate(t.due_at)}</TD>
                      <TD><Badge tone={priorityTone[t.priority]}>{t.priority}</Badge></TD>
                      <TD>
                        <ActionForm action={updateTaskStatus} className="flex items-center gap-1">
                          <input type="hidden" name="id" value={t.id} />
                          <Select name="status" aria-label={`Status of ${t.title}`} defaultValue={t.status} className="min-h-8 !py-1 text-xs">
                            {TASK_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                          </Select>
                          <Button type="submit" variant="subtle" size="sm">Set</Button>
                        </ActionForm>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          {!isStaff ? (
            <Card>
              <CardHeader title="Payments" />
              {!payments.length ? <EmptyState title="No payments recorded for this project" /> : (
                <Table minWidth={480}>
                  <thead><tr><TH>Date</TH><TH>Amount</TH><TH>Status</TH></tr></thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <TD className="text-xs">{formatDate(p.paid_at)}</TD>
                        <TD className={`tabular-nums ${p.transaction_type === 'refund' ? 'text-danger' : ''}`}>{p.transaction_type === 'refund' ? '−' : ''}{formatNGN(p.amount)}</TD>
                        <TD><Badge tone={paymentTone[p.status]}>{p.status}</Badge></TD>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Client & team" />
            <dl className="px-4 py-1">
              <DetailRow label="Client">{client ? <Link href={`/prospects/${client.id}`} className="hover:text-gold">{client.company_name}</Link> : project.client_name || '—'}</DetailRow>
              <DetailRow label="Contact">{client?.contact_name || '—'}</DetailRow>
              <DetailRow label="Email">{client?.email || '—'}</DetailRow>
              <DetailRow label="Phone">{client?.phone || '—'}</DetailRow>
              <DetailRow label="Source deal">{deal ? <Link href={`/deals/${deal.id}`} className="hover:text-gold">{deal.title}</Link> : '—'}</DetailRow>
              <DetailRow label="Start">{formatDate(project.start_date)}</DetailRow>
              <DetailRow label="Assigned">{one(project.assigned as Rel<{ full_name: string }>)?.full_name ?? 'Unassigned'}</DetailRow>
            </dl>
            {!isStaff ? (
              <ActionForm action={assignRecord} className="flex gap-2 border-t border-line p-4">
                <input type="hidden" name="record_type" value="project" />
                <input type="hidden" name="record_id" value={project.id} />
                <Select name="staff_id" aria-label="Assign team member" defaultValue={project.assigned_to ?? ''}>
                  <option value="">Unassigned</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
                <Button type="submit" variant="ghost">Assign</Button>
              </ActionForm>
            ) : null}
          </Card>

          {project.description ? (
            <Card>
              <CardHeader title="Scope" />
              <p className="whitespace-pre-wrap px-4 py-4 text-sm text-muted">{project.description}</p>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Project activity" />
            {!activity.length ? <EmptyState title="No recorded activity" hint="Activity is visible where your permissions allow." /> : (
              <ul>
                {activity.map((a) => (
                  <li key={a.id} className="border-b border-line/60 px-4 py-2.5 text-sm last:border-0">
                    <p className="capitalize">{a.action.replace(/_/g, ' ')}</p>
                    <p className="text-[11px] text-muted">{one(a.actor)?.full_name ?? 'System'} · {formatDate(a.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
