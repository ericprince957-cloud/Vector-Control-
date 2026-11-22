import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { Card, CardHeader, Badge, Button, EmptyState } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { ActionForm } from '@/components/action-form';
import { TaskForm } from '@/components/forms';
import { saveTask, updateTaskStatus } from '@/actions/tasks';
import { TASK_STATUSES, label } from '@/lib/constants';
import { SubmitButton } from '@/components/submit-button';

export const dynamic = 'force-dynamic';

const priorityTone: Record<string, 'neutral' | 'gold' | 'red' | 'amber'> = {
  low: 'neutral', medium: 'amber', high: 'gold', urgent: 'red'
};

export default async function TasksPage() {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: tasks }, { data: staffList }, { data: prospects }, { data: projects }] = await Promise.all([
    supabase.from('tasks').select('*, assignee:profiles!tasks_assigned_to_fkey(full_name)').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, email').eq('is_active', true),
    supabase.from('prospects').select('id, company_name').order('company_name'),
    supabase.from('projects').select('id, project_name').order('created_at', { ascending: false })
  ]);

  const staff = (staffList ?? []).map((s) => ({ id: s.id, name: s.full_name || s.email }));
  const prospectOptions = (prospects ?? []).map((p) => ({ id: p.id, name: p.company_name }));
  const projectOptions = (projects ?? []).map((p) => ({ id: p.id, name: p.project_name }));
  const list = tasks ?? [];
  const open = list.filter((t) => t.status === 'todo' || t.status === 'in_progress');
  const nowIso = new Date().toISOString();
  const overdue = open.filter((t) => t.due_at && t.due_at < nowIso);
  const todays = open.filter((t) => t.due_at && t.due_at.slice(0, 10) === nowIso.slice(0, 10));

  const TaskRow = ({ t }: { t: Record<string, never> }) => (
    <div className="flex items-center justify-between gap-3 border-b border-line/60 px-4 py-3 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{t.title}</p>
        <p className="text-xs text-muted">
          {t.assignee?.full_name ?? 'Unassigned'} · due {formatDate(t.due_at)}
          {t.due_at && t.due_at < nowIso && t.status !== 'done' ? <span className="text-red-400"> · overdue</span> : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge tone={priorityTone[t.priority]}>{t.priority}</Badge>
        <ActionForm action={updateTaskStatus} className="flex items-center gap-1">
          <input type="hidden" name="id" value={t.id} />
          <Select name="status" defaultValue={t.status} className="!py-1 text-xs">
            {TASK_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </Select>
          <SubmitButton variant="ghost" className="!px-2 !py-1 text-xs">Set</SubmitButton>
        </ActionForm>
      </div>
    </div>
  );

  return (
    <>
      <PageHeader title="Tasks & follow-ups" description={`${open.length} open · ${todays.length} due today · ${overdue.length} overdue`} />
      <TaskForm action={saveTask} staff={staff} prospects={prospectOptions} projects={projectOptions} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Overdue" subtitle="Requires immediate attention" />
          {overdue.length === 0 ? <EmptyState title="Nothing overdue" /> : overdue.map((t) => <TaskRow key={t.id} t={t} />)}
        </Card>
        <Card>
          <CardHeader title="Today" />
          {todays.length === 0 ? <EmptyState title="No tasks due today" /> : todays.map((t) => <TaskRow key={t.id} t={t} />)}
        </Card>
        <Card>
          <CardHeader title="All open tasks" subtitle={`${open.length} open`} />
          {open.filter((t) => !overdue.includes(t) && !todays.includes(t)).map((t) => <TaskRow key={t.id} t={t} />)}
          {open.length === 0 ? <EmptyState title="No open tasks" /> : null}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Completed & cancelled" subtitle="Recently finished" />
        {list.filter((t) => t.status === 'done' || t.status === 'cancelled').slice(0, 10).map((t) => <TaskRow key={t.id} t={t} />)}
        {list.filter((t) => t.status === 'done' || t.status === 'cancelled').length === 0 ? <EmptyState title="Nothing completed yet" /> : null}
      </Card>
    </>
  );
}
