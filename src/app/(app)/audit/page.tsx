import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireFinanceAccess } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { Card, CardHeader, Table, TH, TD, Badge, EmptyState, ErrorState } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { FilterBar } from '@/components/filter-bar';
import { Pagination } from '@/components/pagination';
import { PAGE_SIZE, pageParam, rangeFor, dateParam, one } from '@/lib/ui-helpers';

export const metadata: Metadata = { title: 'Audit log', description: 'Who changed what, and when.' };
export const dynamic = 'force-dynamic';

type Rel<T> = T | T[] | null;
type SP = { entity?: string; action?: string; actor?: string; from?: string; to?: string; page?: string };

export default async function AuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireFinanceAccess(); // founder / admin; RLS also restricts audit_logs
  const sp = await searchParams;
  const supabase = await createClient();
  const page = pageParam(sp.page);
  const [from, to] = rangeFor(page);
  const dFrom = dateParam(sp.from);
  const dTo = dateParam(sp.to);

  let query = supabase
    .from('audit_logs')
    .select('id, action, entity, entity_id, details, created_at, actor_id, actor:profiles!audit_logs_actor_id_fkey(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (sp.entity) query = query.eq('entity', sp.entity);
  if (sp.action) query = query.eq('action', sp.action);
  if (sp.actor) query = query.eq('actor_id', sp.actor);
  if (dFrom) query = query.gte('created_at', dFrom);
  if (dTo) query = query.lte('created_at', dTo + 'T23:59:59');

  const [{ data, count, error }, { data: meta }, { data: people }] = await Promise.all([
    query.range(from, to),
    supabase.from('audit_logs').select('entity, action').order('created_at', { ascending: false }).limit(1000),
    supabase.from('profiles').select('id, full_name, email')
  ]);
  const entities = [...new Set((meta ?? []).map((m) => m.entity))].sort();
  const actions = [...new Set((meta ?? []).map((m) => m.action))].sort();
  const rows = data ?? [];
  const filtered = Boolean(sp.entity || sp.action || sp.actor || dFrom || dTo);

  return (
    <>
      <PageHeader title="Audit log" description="A read-only record of important changes. Entries cannot be edited here." />
      <FilterBar
        basePath="/audit"
        values={{ entity: sp.entity, action: sp.action, actor: sp.actor, from: sp.from, to: sp.to }}
        filters={[
          { kind: 'select', name: 'entity', label: 'Record type', options: entities.map((e) => ({ value: e, label: e.replace(/_/g, ' ') })) },
          { kind: 'select', name: 'action', label: 'Action', options: actions.map((a) => ({ value: a, label: a.replace(/_/g, ' ') })) },
          { kind: 'select', name: 'actor', label: 'Actor', options: (people ?? []).map((p) => ({ value: p.id, label: p.full_name || p.email })) },
          { kind: 'date', name: 'from', label: 'From' },
          { kind: 'date', name: 'to', label: 'To' }
        ]}
      />
      {error ? <ErrorState title="Could not load the audit log" message={error.message} /> : null}
      <Card>
        <CardHeader title="Activity" subtitle={`${count ?? 0} entries`} />
        {!rows.length && !error ? <EmptyState title={filtered ? 'No entries match these filters' : 'No audit entries yet'} /> : (
          <>
            <Table minWidth={820}>
              <thead><tr><TH>When</TH><TH>Actor</TH><TH>Action</TH><TH>Record</TH><TH>Details</TH></tr></thead>
              <tbody>
                {rows.map((l) => {
                  const actor = one(l.actor as Rel<{ full_name: string | null; email: string }>);
                  return (
                    <tr key={l.id} className="align-top hover:bg-surface-2/60">
                      <TD className="whitespace-nowrap text-xs">{formatDate(l.created_at)}</TD>
                      <TD className="text-xs">{actor?.full_name || actor?.email || 'System'}</TD>
                      <TD><Badge>{l.action.replace(/_/g, ' ')}</Badge></TD>
                      <TD className="text-xs capitalize text-muted">{l.entity.replace(/_/g, ' ')}</TD>
                      <TD className="max-w-sm break-words font-mono text-[11px] text-muted">{JSON.stringify(l.details)}</TD>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination basePath="/audit" page={page} pageSize={PAGE_SIZE} total={count ?? rows.length} params={{ entity: sp.entity, action: sp.action, actor: sp.actor, from: sp.from, to: sp.to }} />
          </>
        )}
      </Card>
    </>
  );
}
