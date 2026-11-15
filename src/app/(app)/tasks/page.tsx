import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { Card, CardHeader, Badge, Button, EmptyState } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { TaskForm } from '@/components/forms';
import { saveTask, toggleTask, deleteTask } from '@/actions/tasks';
import { label } from '@/lib/constants';
import { SubmitButton } from '@/components/submit-button';

export const dynamic = 'force-dynamic';

const priorityTone: Record<string, 'neutral' | 'gold' | 'red' | 'amber'> = {
  low: 'neutral', medium: 'amber', high: 'gold', urgent: 'red'
};

export default async function TasksPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: tasks }, { data: staffList }, { data: prospects }] = await Promise.all([
    supabase.from('tasks').select('*, assignee:profiles!tasks_assigned_to_fkey(full_name)').order('is_completed').order('due_date', { ascending: true }),
    supabase.from('profiles').select('id, full_name, email').eq('is_active', true),
    supabase.from('prospects').select('id, company_name').order('company_name')
  ]);

  const staff = (staffList ?? []).map((s) => ({ id: s.id, name: s.full_name || s.email }));
  const list = tasks ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const open = list.filter((t) => !t.is_completed);
  const overdue = open.filter((t) => t.due_date && t.due_date < today);
  const todays = open.filter((t) => t.due_date === today);

  const TaskRow = ({ t }: { t: Record<string, never> }) => (
    <div className="flex items-center justify-between gap-3 border-b border-line/60 px-4 py-3 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{t.title}</p>
        <p className="text-xs text-muted">
          {t.assignee?.full_name ?? 'Unassigned'} · due {formatDate(t.due_date)}
          {t.due_date && t.due_date < today && !t.is_completed ? <span className="text-red-400"> · overdue</span> : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge tone={priorityTone[t.priority]}>{t.priority}</Badge>
        <form action={toggleTask}>
          <input type="hidden" name="id" value={t.id} />
          <input type="hidden" name="done" value={String(!t.is_completed)} />
          <Button type="submit" variant="ghost" className="!px-2 !py-1 text-xs">{t.is_completed ? 'Reopen' : 'Done'}</Button>
        </form>
        <form action={deleteTask}>
          <input type="hidden" name="id" value={t.id} />
          <Button type="submit" variant="danger" className="!px-2 !py-1 text-xs">✕</Button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <PageHeader title="Tasks & follow-ups" description={`${open.length} open · ${todays.length} due today · ${overdue.length} overdue`} />
      <TaskForm action={saveTask} staff={staff} prospects={prospects ?? []} />

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
        <CardHeader title="Completed" subtitle="Recently finished" />
        {list.filter((t) => t.is_completed).slice(0, 10).map((t) => <TaskRow key={t.id} t={t} />)}
        {list.filter((t) => t.is_completed).length === 0 ? <EmptyState title="Nothing completed yet" /> : null}
      </Card>
    </>
  );
}
