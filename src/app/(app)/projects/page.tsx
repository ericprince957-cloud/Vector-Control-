import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatNGN, formatDate } from '@/lib/utils';
import { Card, Table, TH, TD, EmptyState, Badge } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { ProjectForm } from '@/components/forms';
import { saveProject } from '@/actions/projects';
import { label } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const tone: Record<string, 'neutral' | 'gold' | 'green' | 'red' | 'blue' | 'amber'> = {
  not_started: 'neutral', in_progress: 'blue', under_review: 'amber',
  completed: 'green', on_hold: 'amber', cancelled: 'red'
};

export default async function ProjectsPage() {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: projects }, { data: deals }, { data: staffList }] = await Promise.all([
    supabase.from('projects').select('*, staff:profiles!projects_assigned_to_fkey(full_name)').order('due_date', { ascending: true }),
    supabase.from('deals').select('id, title').eq('status', 'won'),
    supabase.from('profiles').select('id, full_name, email').eq('is_active', true)
  ]);

  const staff = (staffList ?? []).map((s) => ({ id: s.id, name: s.full_name || s.email }));
  const list = projects ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const overdue = list.filter((p) => !['completed', 'cancelled'].includes(p.status) && p.due_date && p.due_date < today);

  return (
    <>
      <PageHeader title="Projects" description={`${list.length} total · ${overdue.length} overdue · ${list.filter((p) => p.status === 'completed').length} completed`} />
      <ProjectForm action={saveProject} deals={deals ?? []} staff={staff} />

      <Card>
        {!list.length ? <EmptyState title="No projects yet" hint="Convert a won deal or create a project manually." /> : (
          <Table>
            <thead><tr><TH>Project</TH><TH>Client</TH><TH>Status</TH><TH>Contract</TH><TH>Assigned</TH><TH>Due</TH></tr></thead>
            <tbody>
              {list.map((p) => {
                const isOverdue = !['completed', 'cancelled'].includes(p.status) && p.due_date && p.due_date < today;
                return (
                  <tr key={p.id} className="hover:bg-surface-2/60">
                    <TD className="font-medium">{p.project_name}<p className="max-w-xs truncate text-xs text-muted">{p.description}</p></TD>
                    <TD>{p.client_name || '—'}</TD>
                    <TD><Badge tone={tone[p.status]}>{label(p.status)}</Badge></TD>
                    <TD className="tabular-nums">{formatNGN(p.contract_value)}</TD>
                    <TD className="text-xs text-muted">{p.staff?.full_name ?? 'Unassigned'}</TD>
                    <TD className={`text-xs ${isOverdue ? 'text-red-400' : ''}`}>{formatDate(p.due_date)}{isOverdue ? ' · overdue' : ''}</TD>
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
