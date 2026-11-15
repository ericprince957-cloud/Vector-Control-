import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatNGN, formatDate } from '@/lib/utils';
import { Card, CardHeader, StatCard, Table, TH, TD, EmptyState } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { RejectionForm } from '@/components/forms';
import { saveRejection } from '@/actions/rejections';
import { label } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function RejectionsPage() {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: rejections }, { data: prospects }, { data: deals }] = await Promise.all([
    supabase.from('rejections').select('*, prospect:prospects(company_name, industry), deal:deals(title, quoted_amount)').order('rejected_at', { ascending: false }),
    supabase.from('prospects').select('id, company_name').order('company_name'),
    supabase.from('deals').select('id, title').order('created_at', { ascending: false })
  ]);

  const list = rejections ?? [];
  const byReason = list.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.reason]: (acc[r.reason] ?? 0) + 1 }), {});
  const lostValue = list.reduce((s, r) => s + Number(r.deal?.quoted_amount ?? 0), 0);
  const competitors = list.filter((r) => r.competitor).reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.competitor]: (acc[r.competitor] ?? 0) + 1 }), {});

  return (
    <>
      <PageHeader title="Rejections & lost opportunities" description="Every rejection is preserved — records are never deleted through normal actions." />
      <RejectionForm action={saveRejection} prospects={prospects ?? []} deals={deals ?? []} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total rejections" value={list.length} />
        <StatCard label="Lost deal value" value={formatNGN(lostValue)} tone="red" />
        <StatCard label="Top reason" value={Object.entries(byReason).sort((a, b) => b[1] - a[1])[0]?.[0] ? label(Object.entries(byReason).sort((a, b) => b[1] - a[1])[0][0]) : '—'} tone="gold" />
        <StatCard label="Competitors named" value={Object.keys(competitors).length} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Rejection records" />
          {!list.length ? <EmptyState title="No rejections recorded" /> : (
            <Table>
              <thead><tr><TH>Date</TH><TH>Prospect</TH><TH>Reason</TH><TH>Competitor</TH><TH>Lost value</TH></tr></thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id}>
                    <TD className="text-xs">{formatDate(r.rejected_at)}</TD>
                    <TD className="font-medium">{r.prospect?.company_name ?? '—'}</TD>
                    <TD className="capitalize">{label(r.reason)}</TD>
                    <TD className="text-muted">{r.competitor || '—'}</TD>
                    <TD className="tabular-nums">{r.deal ? formatNGN(r.deal.quoted_amount) : '—'}</TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Most common reasons" />
          <div className="p-4">
            {Object.entries(byReason).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
              <div key={reason} className="flex items-center justify-between border-b border-line/50 py-2 text-sm last:border-0">
                <span className="capitalize">{label(reason)}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
            {Object.keys(byReason).length === 0 ? <EmptyState title="No data" /> : null}
          </div>
        </Card>
      </div>
    </>
  );
}
