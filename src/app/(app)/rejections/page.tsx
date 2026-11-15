import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatNGN, formatDate } from '@/lib/utils';
import { Card, CardHeader, StatCard, Table, TH, TD, EmptyState, Badge } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { RejectionForm } from '@/components/forms';
import { saveRejection } from '@/actions/rejections';
import { label } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function RejectionsPage() {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: rejections }, { data: prospects }, { data: deals }] = await Promise.all([
    supabase.from('rejections').select('*, prospect:prospects(company_name), deal:deals(title, deal_value)').order('rejected_at', { ascending: false }),
    supabase.from('prospects').select('id, company_name').order('company_name'),
    supabase.from('deals').select('id, title').order('created_at', { ascending: false })
  ]);

  const list = rejections ?? [];
  const byCategory = list.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.category]: (acc[r.category] ?? 0) + 1 }), {});
  const lostValue = list.reduce((s, r) => s + Number(r.potential_value ?? 0), 0);
  const followUpPossible = list.filter((r) => r.follow_up_possible).length;
  const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

  return (
    <>
      <PageHeader title="Rejections & lost opportunities" description="Records can be created with or without a formal deal. History is preserved — rejections are never deleted." />
      <RejectionForm action={saveRejection} prospects={prospects ?? []} deals={deals ?? []} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total rejections" value={list.length} />
        <StatCard label="Potential value lost" value={formatNGN(lostValue)} tone="red" />
        <StatCard label="Top category" value={topCategory ? label(topCategory[0]) : '—'} tone="gold" />
        <StatCard label="Follow-up possible" value={followUpPossible} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Rejection records" />
          {!list.length ? <EmptyState title="No rejections recorded" /> : (
            <Table>
              <thead><tr><TH>Date</TH><TH>Company</TH><TH>Category</TH><TH>Potential value</TH><TH>Follow-up</TH></tr></thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id}>
                    <TD className="text-xs">{formatDate(r.rejected_at)}</TD>
                    <TD className="font-medium">{r.prospect?.company_name || r.company_name || '—'}<p className="text-xs text-muted">{r.reason}</p></TD>
                    <TD><Badge>{label(r.category)}</Badge></TD>
                    <TD className="tabular-nums">{formatNGN(r.potential_value)}</TD>
                    <TD>{r.follow_up_possible ? <Badge tone="amber">{formatDate(r.follow_up_at)}</Badge> : <span className="text-xs text-muted">No</span>}</TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Most common categories" />
          <div className="p-4">
            {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
              <div key={cat} className="flex items-center justify-between border-b border-line/50 py-2 text-sm last:border-0">
                <span className="capitalize">{label(cat)}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
            {Object.keys(byCategory).length === 0 ? <EmptyState title="No data" /> : null}
          </div>
        </Card>
      </div>
    </>
  );
}
