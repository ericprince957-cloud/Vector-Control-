import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { Card, CardHeader, StatCard, Table, TH, TD, Badge, EmptyState, ErrorState, Button, Select } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { ActionForm } from '@/components/action-form';
import { FilterBar } from '@/components/filter-bar';
import { Pagination } from '@/components/pagination';
import { TaskDialog } from '@/components/forms';
import { saveTask, updateTaskStatus } from '@/actions/tasks';
import { TASK_STATUSES, TASK_PRIORITIES, label } from '@/lib/constants';
import { PAGE_SIZE, pageParam, rangeFor, safeSearch, one, priorityTone, taskTone } from '@/lib/ui-helpers';

export const metadata: Metadata = { title: 'Tasks', description: 'Follow-ups, deliverables and internal work.' };
export const dynamic = 'force-dynamic';

type Rel<T> = T | T[] | null;
type SP = { status?: string; priority?: string; assignee?: string; q?: string; overdue?: string; page?: string };

export default async function TasksPage({ searchParams }: { searchParams: Promise<SP> }) {
  const profile = await requireProfile();
  const isStaff = profile.role === 'staff';
  const sp = await searchParams;
  const supabase = await createClient();
  const page = pageParam(sp.page);
  const [from, to] = rangeFor(page);
  const q = safeSearch(sp.q);
  const nowIso = new Date().toISOString();

  let query = supabase
    .from('tasks')
    .select('*, assignee:profiles!tasks_assigned_to_fkey(full_name), prospect:prospects(company_name), project:projects(project_name)', { count: 'exact' })
    .order('due_at', { ascending: true, nullsFirst: false });
  if ((TASK_STATUSES as readonly string[]).includes(sp.status ?? '')) query = query.eq('status', sp.status!);
  if ((TASK_PRIORITIES as readonly string[]).includes(sp.priority ?? '')) query = query.eq('priority', sp.priority!);
  if (sp.assignee) query = query.eq('assigned_to', sp.assignee === 'me' ? profile.id : sp.assignee);
  if (sp.overdue === '1') query = query.lt('due_at', nowIso).in('status', ['todo', 'in_progress']);
  if (q) query = query.ilike('title', `%${q}%`);

  const [{ data: tasks, count, error }, { data: staffList }, { data: prospects }, { data: projects }, { data: open }] = await Promise.all([
    query.range(from, to),
    supabase.from('profiles').select('id, full_name, email').eq('is_active', true),
    supabase.from('prospects').select('id, company_name').order('company_name'),
    supabase.from('projects').select('id, project_name').order('created_at', { ascending: false }),
    supabase.from('tasks').select('status, due_at, assigned_to')
  ]);

  const staff = (staffList ?? []).map((s) => ({ id: s.id, name: s.full_name || s.email }));
  const prospectOptions = (prospects ?? []).map((p) => ({ id: p.id, name: p.company_name }));
  const projectOptions = (projects ?? []).map((p) => ({ id: p.id, name: p.project_name }));
  const rows = tasks ?? [];
  const all = open ?? [];
  const active = all.filter((t) => t.status === 'todo' || t.status === 'in_progress');
  const overdueCount = active.filter((t) => t.due_at && t.due_at < nowIso).length;
  const mine = active.filter((t) => t.assigned_to === profile.id).length;
  const filtered = Boolean(sp.status || sp.priority || sp.assignee || sp.overdue || q);

  return (
    <>
      <PageHeader title="Tasks" description="Follow-ups, deliverables and internal work.">
        <TaskDialog action={saveTask} staff={staff} prospects={prospectOptions} projects={projectOptions} />
      </PageHeader>

      <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Open tasks" value={active.length} />
        <StatCard label="Assigned to me" value={mine} tone="gold" />
        <StatCard label="Overdue" value={overdueCount} tone={overdueCount ? 'red' : undefined} />
        <StatCard label="Completed" value={all.filter((t) => t.status === 'done').length} tone="green" />
      </section>

      <FilterBar
        basePath="/tasks"
        values={{ q: sp.q, status: sp.status, priority: sp.priority, assignee: sp.assignee, overdue: sp.overdue }}
        filters={[
          { kind: 'search', name: 'q', placeholder: 'Search tasks…' },
          { kind: 'select', name: 'status', label: 'Status', options: TASK_STATUSES.map((s) => ({ value: s, label: label(s) })) },
          { kind: 'select', name: 'priority', label: 'Priority', options: TASK_PRIORITIES.map((s) => ({ value: s, label: label(s) })) },
          { kind: 'select', name: 'assignee', label: 'Assignee', options: [{ value: 'me', label: 'Me' }, ...(isStaff ? [] : staff.map((s) => ({ value: s.id, label: s.name })))] },
          { kind: 'select', name: 'overdue', label: 'Due', options: [{ value: '1', label: 'Overdue only' }] }
        ]}
      />
      {error ? <ErrorState title="Could not load tasks" message={error.message} /> : null}

      <Card>
        <CardHeader title="Task list" subtitle={`${count ?? 0} tasks`} />
        {!rows.length && !error ? (
          <EmptyState title={filtered ? 'No tasks match these filters' : 'No tasks yet'} hint={filtered ? undefined : 'Create a task to track a follow-up or deliverable.'} />
        ) : (
          <>
            <Table minWidth={900}>
              <thead><tr><TH>Task</TH><TH>Linked to</TH><TH>Assignee</TH><TH>Due</TH><TH>Priority</TH><TH>Status</TH><TH><span className="sr-only">Edit</span></TH></tr></thead>
              <tbody>
                {rows.map((t) => {
                  const prospect = one(t.prospect as Rel<{ company_name: string }>);
                  const project = one(t.project as Rel<{ project_name: string }>);
                  const late = t.due_at && t.due_at < nowIso && (t.status === 'todo' || t.status === 'in_progress');
                  return (
                    <tr key={t.id} className="hover:bg-surface-2/60">
                      <TD><p className={t.status === 'done' ? 'text-muted line-through' : ''}>{t.title}</p></TD>
                      <TD className="text-xs text-muted">
                        {t.prospect_id && prospect ? <Link href={`/prospects/${t.prospect_id}`} className="hover:text-gold">{prospect.company_name}</Link> : null}
                        {t.project_id && project ? <Link href={`/projects/${t.project_id}`} className="hover:text-gold">{project.project_name}</Link> : null}
                        {!prospect && !project ? '—' : null}
                      </TD>
                      <TD className="text-xs text-muted">{one(t.assignee as Rel<{ full_name: string }>)?.full_name ?? 'Unassigned'}</TD>
                      <TD className={`whitespace-nowrap text-xs ${late ? 'text-danger' : ''}`}>{formatDate(t.due_at)}{late ? ' · overdue' : ''}</TD>
                      <TD><Badge tone={priorityTone[t.priority]}>{t.priority}</Badge></TD>
                      <TD>
                        <ActionForm action={updateTaskStatus} className="flex items-center gap-1">
                          <input type="hidden" name="id" value={t.id} />
                          <Select name="status" aria-label={`Status of ${t.title}`} defaultValue={t.status} className="min-h-8 !py-1 text-xs">
                            {TASK_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                          </Select>
                          <Button type="submit" variant="subtle" size="sm">Set</Button>
                        </ActionForm>
                        <span className="sr-only"><Badge tone={taskTone[t.status]}>{t.status}</Badge></span>
                      </TD>
                      <TD><TaskDialog action={saveTask} staff={staff} prospects={prospectOptions} projects={projectOptions} task={t} /></TD>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination basePath="/tasks" page={page} pageSize={PAGE_SIZE} total={count ?? rows.length} params={{ q: sp.q, status: sp.status, priority: sp.priority, assignee: sp.assignee, overdue: sp.overdue }} />
          </>
        )}
      </Card>
    </>
  );
}
