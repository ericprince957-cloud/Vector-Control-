import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { Card, CardHeader, StatCard, Table, TH, TD, Badge, EmptyState, ErrorState } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { FilterBar } from '@/components/filter-bar';
import { Pagination } from '@/components/pagination';
import { RejectionDialog } from '@/components/forms';
import { HorizontalBars } from '@/components/charts';
import { saveRejection } from '@/actions/rejections';
import { label } from '@/lib/constants';
import { PAGE_SIZE, pageParam, rangeFor, dateParam, one } from '@/lib/ui-helpers';

export const metadata: Metadata = { title: 'Rejections', description: 'Why prospects and deals were lost.' };
export const dynamic = 'force-dynamic';

type Rel<T> = T | T[] | null;
type SP = { category?: string; from?: string; to?: string; page?: string };

export default async function RejectionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireProfile();
  const sp = await searchParams;
  const supabase = await createClient();
  const page = pageParam(sp.page);
  const [from, to] = rangeFor(page);
  const dFrom = dateParam(sp.from);
  const dTo = dateParam(sp.to);

  let query = supabase
    .from('rejections')
    .select('id, category, reason, rejected_at, prospect_id, deal_id, prospect:prospects(company_name), deal:deals(title)', { count: 'exact' })
    .order('rejected_at', { ascending: false });
  if (sp.category) query = query.eq('category', sp.category);
  if (dFrom) query = query.gte('rejected_at', dFrom);
  if (dTo) query = query.lte('rejected_at', dTo + 'T23:59:59');

  const [{ data: rows, count, error }, { data: cats }, { data: prospects }, { data: deals }] = await Promise.all([
    query.range(from, to),
    supabase.from('rejections').select('category'),
    supabase.from('prospects').select('id, company_name').order('company_name'),
    supabase.from('deals').select('id, title').order('created_at', { ascending: false })
  ]);

  const counts = (cats ?? []).reduce<Record<string, number>>((a, r) => { a[r.category] = (a[r.category] ?? 0) + 1; return a; }, {});
  const chart = Object.entries(counts).map(([k, v]) => ({ name: label(k), value: v })).sort((a, b) => b.value - a.value);
  const categories = Object.keys(counts).sort();
  const list = rows ?? [];
  const filtered = Boolean(sp.category || dFrom || dTo);

  return (
    <>
      <PageHeader title="Rejections" description="Record why prospects or deals were lost so patterns become visible.">
        <RejectionDialog
          action={saveRejection}
          prospects={(prospects ?? []).map((p) => ({ id: p.id, name: p.company_name }))}
          deals={(deals ?? []).map((d) => ({ id: d.id, name: d.title }))}
        />
      </PageHeader>

      <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Total rejections" value={(cats ?? []).length} tone="red" />
        <StatCard label="Most common reason" value={chart[0]?.name ?? '—'} />
        <StatCard label="Matching filters" value={count ?? 0} />
      </section>

      <FilterBar
        basePath="/rejections"
        values={{ category: sp.category, from: sp.from, to: sp.to }}
        filters={[
          { kind: 'select', name: 'category', label: 'Reason', options: categories.map((c) => ({ value: c, label: label(c) })) },
          { kind: 'date', name: 'from', label: 'From' },
          { kind: 'date', name: 'to', label: 'To' }
        ]}
      />
      {error ? <ErrorState title="Could not load rejections" message={error.message} /> : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Rejection log" />
          {!list.length && !error ? (
            <EmptyState title={filtered ? 'No rejections match these filters' : 'No rejections recorded'} hint={filtered ? undefined : 'Good news, or nothing logged yet.'} />
          ) : (
            <>
              <Table minWidth={640}>
                <thead><tr><TH>Date</TH><TH>Prospect / deal</TH><TH>Reason</TH><TH>Notes</TH></tr></thead>
                <tbody>
                  {list.map((r) => {
                    const p = one(r.prospect as Rel<{ company_name: string }>);
                    const d = one(r.deal as Rel<{ title: string }>);
                    return (
                      <tr key={r.id} className="align-top hover:bg-surface-2/60">
                        <TD className="whitespace-nowrap text-xs">{formatDate(r.rejected_at)}</TD>
                        <TD>
                          {r.prospect_id ? <Link href={`/prospects/${r.prospect_id}`} className="hover:text-gold">{p?.company_name}</Link> : '—'}
                          {r.deal_id ? <p className="text-xs text-muted"><Link href={`/deals/${r.deal_id}`} className="hover:text-gold">{d?.title}</Link></p> : null}
                        </TD>
                        <TD><Badge tone="red">{label(r.category)}</Badge></TD>
                        <TD className="max-w-xs text-xs text-muted">{r.reason || '—'}</TD>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
              <Pagination basePath="/rejections" page={page} pageSize={PAGE_SIZE} total={count ?? list.length} params={{ category: sp.category, from: sp.from, to: sp.to }} />
            </>
          )}
        </Card>
        <Card className="h-fit">
          <CardHeader title="Common reasons" />
          <div className="p-4">{chart.length ? <HorizontalBars data={chart} /> : <EmptyState title="No data yet" />}</div>
        </Card>
      </div>
    </>
  );
}
