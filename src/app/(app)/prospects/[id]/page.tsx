import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatNGN, formatDate } from '@/lib/utils';
import { Card, CardHeader, Table, TH, TD, EmptyState, Badge, Button } from '@/components/ui';
import { label } from '@/lib/constants';
import { deleteProspect } from '@/actions/prospects';

export const dynamic = 'force-dynamic';

const TABS = ['overview', 'outreach', 'deals', 'tasks', 'notes'] as const;

export default async function ProspectDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  await requireProfile();
  const { id } = await params;
  const tab = (await searchParams).tab ?? 'overview';
  const supabase = await createClient();

  const { data: prospect } = await supabase.from('prospects').select('*, assigned_profile:profiles!prospects_assigned_to_fkey(full_name)').eq('id', id).single();
  if (!prospect) notFound();

  const [outreachRes, dealsRes, tasksRes] = await Promise.all([
    supabase.from('outreach_activities').select('*').eq('prospect_id', id).order('occurred_at', { ascending: false }),
    supabase.from('deals').select('*').eq('prospect_id', id).order('created_at', { ascending: false }),
    supabase.from('tasks').select('*').eq('prospect_id', id).order('created_at', { ascending: false })
  ]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/prospects" className="text-xs text-muted hover:text-gold">← Back to prospects</Link>
          <h1 className="mt-1 text-lg font-semibold">{prospect.company_name}</h1>
          <p className="text-sm text-muted">{prospect.contact_name}{prospect.industry ? ` · ${prospect.industry}` : ''}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/prospects?status=${prospect.status}`}><Badge tone="gold">{label(prospect.status)}</Badge></Link>
          <form action={deleteProspect}>
            <input type="hidden" name="id" value={prospect.id} />
            <Button variant="danger" type="submit">Delete</Button>
          </form>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t} href={`/prospects/${id}?tab=${t}`}>
            <span className={`inline-block rounded-md border px-3 py-1.5 text-xs capitalize ${tab === t ? 'border-gold/60 text-gold' : 'border-line text-muted hover:text-text'}`}>{t}</span>
          </Link>
        ))}
      </div>

      {tab === 'overview' ? (
        <Card className="p-5">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            {[
              ['Email', prospect.email || '—'], ['Phone', prospect.phone || '—'], ['WhatsApp', prospect.whatsapp || '—'],
              ['Website', prospect.website || '—'], ['Location', prospect.location || '—'], ['Lead source', prospect.lead_source || '—'],
              ['Estimated budget', formatNGN(prospect.estimated_budget)], ['Assigned to', prospect.assigned_profile?.full_name ?? 'Unassigned'],
              ['Created', formatDate(prospect.created_at)], ['Last contact', formatDate(prospect.last_contact_at)], ['Next follow-up', formatDate(prospect.next_follow_up_date)]
            ].map(([k, v]) => (
              <div key={k as string}><dt className="text-xs text-muted">{k}</dt><dd className="mt-0.5">{v}</dd></div>
            ))}
          </dl>
        </Card>
      ) : null}

      {tab === 'outreach' ? (
        <Card>
          <CardHeader title="Outreach history" subtitle={`${outreachRes.data?.length ?? 0} records`} />
          {!(outreachRes.data ?? []).length ? <EmptyState title="No outreach recorded" /> : (
            <Table>
              <thead><tr><TH>Date</TH><TH>Channel</TH><TH>Direction</TH><TH>Outcome</TH><TH>Summary</TH></tr></thead>
              <tbody>
                {(outreachRes.data ?? []).map((o) => (
                  <tr key={o.id}>
                    <TD className="text-xs">{formatDate(o.occurred_at)}</TD>
                    <TD className="capitalize">{o.channel}</TD>
                    <TD className="capitalize text-muted">{o.direction}</TD>
                    <TD><Badge>{label(o.outcome)}</Badge></TD>
                    <TD className="max-w-xs truncate text-xs text-muted">{o.summary}</TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      ) : null}

      {tab === 'deals' ? (
        <Card>
          <CardHeader title="Deals" />
          {!(dealsRes.data ?? []).length ? <EmptyState title="No deals for this prospect" /> : (
            <Table>
              <thead><tr><TH>Title</TH><TH>Status</TH><TH>Quoted</TH><TH>Created</TH></tr></thead>
              <tbody>
                {(dealsRes.data ?? []).map((d) => (
                  <tr key={d.id}>
                    <TD>{d.title}</TD><TD><Badge>{label(d.status)}</Badge></TD>
                    <TD className="tabular-nums">{formatNGN(d.quoted_amount)}</TD>
                    <TD className="text-xs text-muted">{formatDate(d.created_at)}</TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      ) : null}

      {tab === 'tasks' ? (
        <Card>
          <CardHeader title="Tasks" />
          {!(tasksRes.data ?? []).length ? <EmptyState title="No tasks for this prospect" /> : (
            <Table>
              <thead><tr><TH>Title</TH><TH>Priority</TH><TH>Due</TH><TH>Status</TH></tr></thead>
              <tbody>
                {(tasksRes.data ?? []).map((t) => (
                  <tr key={t.id}>
                    <TD>{t.title}</TD><TD className="capitalize">{t.priority}</TD>
                    <TD className="text-xs">{formatDate(t.due_date)}</TD>
                    <TD><Badge tone={t.is_completed ? 'green' : 'amber'}>{t.is_completed ? 'Done' : 'Open'}</Badge></TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      ) : null}

      {tab === 'notes' ? (
        <Card className="p-5"><p className="whitespace-pre-wrap text-sm text-muted">{prospect.notes || 'No notes recorded.'}</p></Card>
      ) : null}
    </>
  );
}
