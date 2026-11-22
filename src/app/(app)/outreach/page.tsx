import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { Card, CardHeader, Table, TH, TD, EmptyState, Badge, ErrorState, StatCard } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { FilterBar } from '@/components/filter-bar';
import { Pagination } from '@/components/pagination';
import { OutreachDialog } from '@/components/forms';
import { saveOutreach } from '@/actions/outreach';
import { OUTREACH_CHANNELS, OUTREACH_OUTCOMES, label } from '@/lib/constants';
import { PAGE_SIZE, pageParam, rangeFor, dateParam, one } from '@/lib/ui-helpers';

export const metadata: Metadata = { title: 'Outreach', description: 'Track every outreach attempt and follow-up.' };
export const dynamic = 'force-dynamic';

type SP = { channel?: string; outcome?: string; staff?: string; from?: string; to?: string; page?: string };

export default async function OutreachPage({ searchParams }: { searchParams: Promise<SP> }) {
  const profile = await requireProfile();
  const sp = await searchParams;
  const supabase = await createClient();
  const page = pageParam(sp.page);
  const [from, to] = rangeFor(page);
  const dFrom = dateParam(sp.from);
  const dTo = dateParam(sp.to);
  const nowIso = new Date().toISOString();

  let query = supabase
    .from('outreach_activities')
    .select('id, channel, direction, outcome, subject, message_summary, contacted_at, next_follow_up_at, prospect_id, prospect:prospects(company_name), creator:profiles!outreach_activities_created_by_fkey(full_name)', { count: 'exact' })
    .order('contacted_at', { ascending: false });
  if ((OUTREACH_CHANNELS as readonly string[]).includes(sp.channel ?? '')) query = query.eq('channel', sp.channel!);
  if ((OUTREACH_OUTCOMES as readonly string[]).includes(sp.outcome ?? '')) query = query.eq('outcome', sp.outcome!);
  if (sp.staff) query = query.eq('created_by', sp.staff);
  if (dFrom) query = query.gte('contacted_at', dFrom);
  if (dTo) query = query.lte('contacted_at', dTo + 'T23:59:59');

  const [{ data: records, count, error }, { data: prospects }, { data: staffList }, { data: followUps }, { count: total }, { count: noResponse }] = await Promise.all([
    query.range(from, to),
    supabase.from('prospects').select('id, company_name').order('company_name'),
    supabase.from('profiles').select('id, full_name, email').eq('is_active', true),
    supabase
      .from('outreach_activities')
      .select('id, next_follow_up_at, prospect_id, prospect:prospects(company_name, status)')
      .not('next_follow_up_at', 'is', null)
      .lte('next_follow_up_at', new Date(Date.now() + 7 * 864e5).toISOString())
      .order('next_follow_up_at', { ascending: true })
      .limit(12),
    supabase.from('outreach_activities').select('id', { count: 'exact', head: true }),
    supabase.from('outreach_activities').select('id', { count: 'exact', head: true }).eq('outcome', 'no_response')
  ]);

  const staff = (staffList ?? []).map((s) => ({ id: s.id, name: s.full_name || s.email }));
  const prospectOptions = (prospects ?? []).map((p) => ({ id: p.id, name: p.company_name }));
  const rows = records ?? [];
  const reminders = (followUps ?? []).filter((f) => {
    const st = one(f.prospect as { company_name: string; status: string } | { company_name: string; status: string }[] | null)?.status;
    return st !== 'converted' && st !== 'disqualified';
  });
  const isStaff = profile.role === 'staff';

  return (
    <>
      <PageHeader title="Outreach" description="Who was contacted, when, through which channel, and what happened. Messages are sent manually from your own devices — this system only records them.">
        <OutreachDialog action={saveOutreach} prospects={prospectOptions} />
      </PageHeader>

      <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Outreach recorded" value={total ?? 0} />
        <StatCard label="Awaiting response" value={noResponse ?? 0} tone="gold" />
        <StatCard label="Follow-ups due (7 days)" value={reminders.length} tone={reminders.some((r) => r.next_follow_up_at! < nowIso) ? 'red' : undefined} />
        <StatCard label="Matching filters" value={count ?? 0} />
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <FilterBar
            basePath="/outreach"
            values={{ channel: sp.channel, outcome: sp.outcome, staff: sp.staff, from: sp.from, to: sp.to }}
            filters={[
              { kind: 'select', name: 'channel', label: 'Channel', options: OUTREACH_CHANNELS.map((c) => ({ value: c, label: label(c) })) },
              { kind: 'select', name: 'outcome', label: 'Outcome', options: OUTREACH_OUTCOMES.map((o) => ({ value: o, label: label(o) })) },
              ...(isStaff ? [] : [{ kind: 'select' as const, name: 'staff', label: 'Contacted by', options: staff.map((s) => ({ value: s.id, label: s.name })) }]),
              { kind: 'date', name: 'from', label: 'From' },
              { kind: 'date', name: 'to', label: 'To' }
            ]}
          />

          {error ? <ErrorState title="Could not load outreach" message={error.message} /> : null}

          <Card>
            <CardHeader title="Outreach history" />
            {!rows.length && !error ? (
              <EmptyState title="No outreach records" hint="Record your first outreach attempt, or adjust the filters." />
            ) : (
              <>
                <Table minWidth={760}>
                  <thead><tr><TH>Date</TH><TH>Prospect</TH><TH>Channel</TH><TH>Outcome</TH><TH>By</TH><TH>Follow-up</TH></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="align-top hover:bg-surface-2/60">
                        <TD className="whitespace-nowrap text-xs">{formatDate(r.contacted_at)}</TD>
                        <TD>
                          <Link href={`/prospects/${r.prospect_id}?tab=outreach`} className="font-medium hover:text-gold">{one(r.prospect as { company_name: string } | { company_name: string }[] | null)?.company_name ?? '—'}</Link>
                          {r.message_summary ? <p className="mt-0.5 max-w-xs text-xs text-muted">{r.message_summary}</p> : null}
                        </TD>
                        <TD>{label(r.channel)}<p className="text-[11px] text-muted">{label(r.direction)}</p></TD>
                        <TD><Badge tone={r.outcome === 'interested' || r.outcome === 'meeting_scheduled' ? 'gold' : r.outcome === 'not_interested' ? 'red' : 'neutral'}>{label(r.outcome ?? 'no_response')}</Badge></TD>
                        <TD className="text-xs text-muted">{one(r.creator as { full_name: string } | { full_name: string }[] | null)?.full_name ?? '—'}</TD>
                        <TD className="whitespace-nowrap text-xs">{formatDate(r.next_follow_up_at)}</TD>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <Pagination basePath="/outreach" page={page} pageSize={PAGE_SIZE} total={count ?? rows.length} params={{ channel: sp.channel, outcome: sp.outcome, staff: sp.staff, from: sp.from, to: sp.to }} />
              </>
            )}
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Follow-up reminders" subtitle="Overdue and due within 7 days" />
          {reminders.length === 0 ? <EmptyState title="No follow-ups due" /> : (
            <ul>
              {reminders.map((f) => {
                const overdue = f.next_follow_up_at! < nowIso;
                const name = one(f.prospect as { company_name: string } | { company_name: string }[] | null)?.company_name ?? 'Prospect';
                return (
                  <li key={f.id} className="border-b border-line/60 last:border-0">
                    <Link href={`/prospects/${f.prospect_id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-surface-2">
                      <span className="truncate">{name}</span>
                      <span className={`shrink-0 text-xs ${overdue ? 'text-danger' : 'text-muted'}`}>{formatDate(f.next_follow_up_at)}{overdue ? ' · overdue' : ''}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
