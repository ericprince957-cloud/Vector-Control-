import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatNGN, formatDate } from '@/lib/utils';
import { Card, Table, TH, TD, EmptyState, Badge, ErrorState, StatCard } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { FilterBar } from '@/components/filter-bar';
import { Pagination } from '@/components/pagination';
import { ProjectDialog } from '@/components/forms';
import { ProjectStatusSelect } from '@/components/project-status-select';
import { saveProject, updateProjectStatus } from '@/actions/projects';
import { PROJECT_STATUSES, label } from '@/lib/constants';
import { PAGE_SIZE, pageParam, rangeFor, safeSearch, one, projectTone } from '@/lib/ui-helpers';

export const metadata: Metadata = { title: 'Projects', description: 'Client project delivery.' };
export const dynamic = 'force-dynamic';

type SP = { q?: string; status?: string; staff?: string; page?: string };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const profile = await requireProfile();
  const isFounder = profile.role === 'founder';
  const isStaff = profile.role === 'staff';
  const sp = await searchParams;
  const supabase = await createClient();
  const page = pageParam(sp.page);
  const [from, to] = rangeFor(page);
  const q = safeSearch(sp.q);
  const today = new Date().toISOString().slice(0, 10);

  let query = supabase
    .from('projects')
    .select('id, project_name, client_name, status, contract_value, due_date, start_date, assigned_to, deal_id, description, assigned:profiles!projects_assigned_to_fkey(full_name)', { count: 'exact' })
    .order('due_date', { ascending: true, nullsFirst: false });
  if (q) query = query.or(`project_name.ilike.%${q}%,client_name.ilike.%${q}%`);
  if (sp.status) query = query.eq('status', sp.status);
  if (sp.staff) query = query.eq('assigned_to', sp.staff);

  const [{ data: projects, count, error }, { data: allProjects }, { data: tasks }, { data: wonDeals }, { data: staffList }] = await Promise.all([
    query.range(from, to),
    supabase.from('projects').select('status, due_date, contract_value'),
    supabase.from('tasks').select('project_id, status').not('project_id', 'is', null),
    supabase.from('deals').select('id, title').eq('status', 'won'),
    supabase.from('profiles').select('id, full_name, email').eq('is_active', true)
  ]);

  const staff = (staffList ?? []).map((s) => ({ id: s.id, name: s.full_name || s.email }));
  const dealOptions = (wonDeals ?? []).map((d) => ({ id: d.id, name: d.title }));
  const rows = projects ?? [];
  const all = allProjects ?? [];
  const active = all.filter((p) => !['completed', 'cancelled'].includes(p.status));
  const overdue = active.filter((p) => p.due_date && p.due_date < today);
  const statusOptions = [...PROJECT_STATUSES.filter((s) => s !== 'under_review'), 'review' as const];

  const progressOf = (id: string) => {
    const linked = (tasks ?? []).filter((t) => t.project_id === id && t.status !== 'cancelled');
    const done = linked.filter((t) => t.status === 'done').length;
    return linked.length ? { pct: Math.round((done / linked.length) * 100), label: `${done}/${linked.length}` } : null;
  };

  return (
    <>
      <PageHeader title="Projects" description={isFounder ? 'Delivery workspace. Only you can approve new client projects and contract-term changes.' : 'Client projects you are assigned to.'}>
        {isFounder ? <ProjectDialog action={saveProject} deals={dealOptions} staff={staff} /> : null}
      </PageHeader>

      <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Active projects" value={active.length} />
        <StatCard label="Overdue" value={overdue.length} tone={overdue.length ? 'red' : undefined} />
        <StatCard label="Completed" value={all.filter((p) => p.status === 'completed').length} tone="green" />
        {!isStaff ? <StatCard label="Active contract value" value={formatNGN(active.reduce((s, p) => s + Number(p.contract_value), 0))} tone="gold" /> : <StatCard label="On hold" value={all.filter((p) => p.status === 'on_hold').length} />}
      </section>

      <FilterBar
        basePath="/projects"
        values={{ q: sp.q, status: sp.status, staff: sp.staff }}
        filters={[
          { kind: 'search', name: 'q', placeholder: 'Search project or client…' },
          { kind: 'select', name: 'status', label: 'Status', options: statusOptions.map((s) => ({ value: s, label: label(s) })) },
          ...(isStaff ? [] : [{ kind: 'select' as const, name: 'staff', label: 'Assigned to', options: staff.map((s) => ({ value: s.id, label: s.name })) }])
        ]}
      />

      {error ? <ErrorState title="Could not load projects" message={error.message} /> : null}

      <Card>
        {!rows.length && !error ? (
          <EmptyState title="No projects found" hint={isFounder ? 'Convert a won deal on the Deals page, or create a project here.' : 'Projects assigned to you will appear here.'} />
        ) : (
          <>
            <Table minWidth={1000}>
              <thead><tr><TH>Project</TH><TH>Client</TH><TH>Status</TH><TH>Progress</TH>{!isStaff ? <TH>Value</TH> : null}<TH>Team</TH><TH>Due</TH>{!isStaff ? <TH><span className="sr-only">Edit</span></TH> : null}</tr></thead>
              <tbody>
                {rows.map((p) => {
                  const isOverdue = !['completed', 'cancelled'].includes(p.status) && p.due_date && p.due_date < today;
                  const prog = progressOf(p.id);
                  return (
                    <tr key={p.id} className="hover:bg-surface-2/60">
                      <TD><Link href={`/projects/${p.id}`} className="font-medium hover:text-gold">{p.project_name}</Link></TD>
                      <TD>{p.client_name || '—'}</TD>
                      <TD>{isStaff ? <Badge tone={projectTone[p.status]}>{label(p.status)}</Badge> : <ProjectStatusSelect projectId={p.id} status={p.status} action={updateProjectStatus} canClose={isFounder} />}</TD>
                      <TD>
                        {prog ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-3"><div className="h-full bg-gold" style={{ width: `${prog.pct}%` }} /></div>
                            <span className="text-[11px] text-muted">{prog.label}</span>
                          </div>
                        ) : <span className="text-[11px] text-muted">No tasks</span>}
                      </TD>
                      {!isStaff ? <TD className="tabular-nums">{formatNGN(p.contract_value)}</TD> : null}
                      <TD className="text-xs text-muted">{one(p.assigned as { full_name: string } | { full_name: string }[] | null)?.full_name ?? 'Unassigned'}</TD>
                      <TD className={`whitespace-nowrap text-xs ${isOverdue ? 'text-danger' : ''}`}>{formatDate(p.due_date)}{isOverdue ? ' · overdue' : ''}</TD>
                      {!isStaff ? <TD><ProjectDialog action={saveProject} deals={dealOptions} staff={staff} project={p} isFounder={isFounder} /></TD> : null}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination basePath="/projects" page={page} pageSize={PAGE_SIZE} total={count ?? rows.length} params={{ q: sp.q, status: sp.status, staff: sp.staff }} />
          </>
        )}
      </Card>
    </>
  );
}
