import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatNGN, formatDate } from '@/lib/utils';
import { Card, CardHeader, Table, TH, TD, EmptyState, Badge, Tabs, DetailRow, Button, Select, LinkButton } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { ActionForm } from '@/components/action-form';
import { ProspectDialog, OutreachDialog, TaskDialog } from '@/components/forms';
import { label } from '@/lib/constants';
import { archiveProspect, deleteProspect, saveProspect } from '@/actions/prospects';
import { saveOutreach } from '@/actions/outreach';
import { saveTask } from '@/actions/tasks';
import { assignRecord } from '@/actions/staff';
import { one, prospectTone, dealTone, taskTone, priorityTone, netAmount } from '@/lib/ui-helpers';

export const dynamic = 'force-dynamic';

const TAB_KEYS = ['overview', 'history', 'outreach', 'deals', 'tasks', 'notes'] as const;
type TabKey = (typeof TAB_KEYS)[number];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('prospects').select('company_name').eq('id', id).maybeSingle();
  return { title: data?.company_name ?? 'Prospect' };
}

export default async function ProspectDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const profile = await requireProfile();
  const { id } = await params;
  const rawTab = (await searchParams).tab ?? 'overview';
  const tab: TabKey = (TAB_KEYS as readonly string[]).includes(rawTab) ? (rawTab as TabKey) : 'overview';
  const supabase = await createClient();
  const isStaff = profile.role === 'staff';

  const { data: prospect } = await supabase
    .from('prospects')
    .select('*, assigned:profiles!prospects_assigned_to_fkey(full_name)')
    .eq('id', id)
    .maybeSingle();
  if (!prospect) notFound();

  const [outreachRes, dealsRes, tasksRes, rejectionsRes, staffRes, projectsRes, paymentsRes] = await Promise.all([
    supabase.from('outreach_activities').select('*, creator:profiles!outreach_activities_created_by_fkey(full_name)').eq('prospect_id', id).order('contacted_at', { ascending: false }),
    supabase.from('deals').select('*').eq('prospect_id', id).order('created_at', { ascending: false }),
    supabase.from('tasks').select('*, assignee:profiles!tasks_assigned_to_fkey(full_name)').eq('prospect_id', id).order('created_at', { ascending: false }),
    supabase.from('rejections').select('*').eq('prospect_id', id).order('rejected_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, email').eq('is_active', true),
    supabase.from('projects').select('id, project_name').order('created_at', { ascending: false }),
    !isStaff ? supabase.from('payments').select('id, amount, status, transaction_type, paid_at').eq('prospect_id', id).order('paid_at', { ascending: false }) : Promise.resolve({ data: null })
  ]);

  const outreach = outreachRes.data ?? [];
  const deals = dealsRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const rejections = rejectionsRes.data ?? [];
  const prospectPayments = (paymentsRes.data ?? []) as { id: string; amount: number; status: string; transaction_type: string; paid_at: string }[];
  const received = prospectPayments.reduce((sum, payment) => sum + netAmount(payment), 0);
  const outstanding = Math.max(0, Number(prospect.estimated_value) - received);
  const staff = (staffRes.data ?? []).map((s) => ({ id: s.id, name: s.full_name || s.email }));
  const projectOptions = (projectsRes.data ?? []).map((p) => ({ id: p.id, name: p.project_name }));
  const thisProspect = [{ id: prospect.id, name: prospect.company_name }];
  const archived = prospect.status === 'disqualified';
  const contactMessage = prospect.prefilled_message || `Hello ${prospect.contact_name || 'there'}, I’m reaching out regarding ${prospect.company_name}. I’m with Vector Codes and would love to discuss how we could help your business.`;
  const waRaw = prospect.whatsapp_link || prospect.phone || '';
  const whatsappHref = waRaw ? (waRaw.startsWith('http') ? (waRaw.includes('?') ? waRaw : `${waRaw}?${new URLSearchParams({ text: contactMessage })}`) : `https://wa.me/${waRaw.replace(/\\D/g, '').replace(/^0/, '234')}?${new URLSearchParams({ text: contactMessage })}`) : '';
  const emailRaw = prospect.email_link || prospect.email || '';
  const emailHref = emailRaw ? (emailRaw.startsWith('mailto:') ? (emailRaw.includes('?') ? emailRaw : `${emailRaw}?subject=${encodeURIComponent('A quick introduction from Vector Codes')}&body=${encodeURIComponent(contactMessage)}`) : `mailto:${emailRaw}?subject=${encodeURIComponent('A quick introduction from Vector Codes')}&body=${encodeURIComponent(contactMessage)}`) : '';
  const tgRaw = prospect.telegram_link || '';
  const telegramHref = tgRaw ? (tgRaw.startsWith('http') ? (tgRaw.includes('?') ? tgRaw : `${tgRaw}?text=${encodeURIComponent(contactMessage)}`) : `https://t.me/${tgRaw.replace(/^@/, '')}?text=${encodeURIComponent(contactMessage)}`) : '';

  // Chronological history across every record linked to this prospect.
  const history = [
    { at: prospect.created_at, title: 'Prospect added', detail: prospect.source ? `Source: ${prospect.source}` : '' },
    ...outreach.map((o) => ({ at: o.contacted_at, title: `${label(o.direction)} ${label(o.channel)}`, detail: `${label(o.outcome ?? 'no_response')}${o.message_summary ? ` — ${o.message_summary}` : ''}` })),
    ...deals.map((d) => ({ at: d.created_at, title: `Deal: ${d.title}`, detail: `${label(d.status)} · ${formatNGN(d.deal_value)}` })),
    ...tasks.map((t) => ({ at: t.created_at, title: `Task: ${t.title}`, detail: label(t.status) })),
    ...rejections.map((r) => ({ at: r.rejected_at, title: 'Rejection recorded', detail: `${label(r.category)}${r.reason ? ` — ${r.reason}` : ''}` }))
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));

  const base = `/prospects/${id}`;
  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'history', label: 'History' },
    { key: 'outreach', label: `Outreach (${outreach.length})` },
    { key: 'deals', label: `Deals (${deals.length})` },
    { key: 'tasks', label: `Tasks (${tasks.length})` },
    { key: 'notes', label: 'Notes' }
  ].map((t) => ({ ...t, href: `${base}?tab=${t.key}` }));

  return (
    <>
      <PageHeader
        back={{ href: '/prospects', label: 'All prospects' }}
        title={prospect.company_name}
        description={[prospect.contact_name, prospect.industry, prospect.location].filter(Boolean).join(' · ') || undefined}
      >
        <Badge tone={prospectTone[prospect.status]}>{label(prospect.status)}</Badge>
        <ProspectDialog action={saveProspect} staff={staff} canAssign={!isStaff} prospect={prospect} />
        <OutreachDialog action={saveOutreach} prospects={thisProspect} defaultProspectId={prospect.id} />
        <TaskDialog action={saveTask} staff={staff} prospects={thisProspect} projects={projectOptions} defaultProspectId={prospect.id} />
        {profile.role === 'founder' ? (
          <ActionForm action={deleteProspect} confirm={{ title: 'Permanently delete this prospect?', description: 'This removes the prospect record. Linked outreach history will be removed; payment ledger entries remain but are detached. This cannot be undone.', confirmLabel: 'Delete prospect' }}>
            <input type="hidden" name="id" value={prospect.id} />
            <Button type="submit" variant="danger">Delete</Button>
          </ActionForm>
        ) : null}
        {!archived ? (
          <ActionForm
            action={archiveProspect}
            confirm={{
              title: 'Archive this prospect?',
              description: 'The prospect will be marked disqualified. All outreach, deals and history are preserved and nothing is deleted.',
              confirmLabel: 'Archive prospect'
            }}
          >
            <input type="hidden" name="id" value={prospect.id} />
            <Button type="submit" variant="danger">Archive</Button>
          </ActionForm>
        ) : null}
      </PageHeader>

      <Tabs tabs={tabs} active={tab} />

      {tab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Business & contact details" />
            <dl className="px-4 py-1">
              <DetailRow label="Contact person">{prospect.contact_name || '—'}</DetailRow>
              <DetailRow label="Email">{prospect.email ? <a className="hover:text-gold" href={`mailto:${prospect.email}`}>{prospect.email}</a> : '—'}</DetailRow>
              <DetailRow label="Contact actions"><div className="flex flex-wrap gap-3">
                {whatsappHref ? <a className="font-medium text-emerald-600 hover:underline" href={whatsappHref} target="_blank" rel="noreferrer">WhatsApp</a> : null}
                {emailHref ? <a className="font-medium text-sky-600 hover:underline" href={emailHref}>Email</a> : null}
                {telegramHref ? <a className="font-medium text-blue-500 hover:underline" href={telegramHref} target="_blank" rel="noreferrer">Telegram</a> : null}
                {!whatsappHref && !emailHref && !telegramHref ? '—' : null}
              </div></DetailRow>
              <DetailRow label="Prefilled message"><span className="whitespace-pre-wrap">{prospect.prefilled_message || 'Default Vector Codes introduction'}</span></DetailRow>
              <DetailRow label="Phone">{prospect.phone || '—'}</DetailRow>
              <DetailRow label="Website">{prospect.website_url || '—'}</DetailRow>
              <DetailRow label="Location">{prospect.location || '—'}</DetailRow>
              <DetailRow label="Industry">{prospect.industry || '—'}</DetailRow>
              <DetailRow label="Source">{prospect.source || '—'}</DetailRow>
              <DetailRow label="Agreed / estimated value">{formatNGN(prospect.estimated_value)}</DetailRow>
              {!isStaff ? <DetailRow label="Received">{formatNGN(received)}</DetailRow> : null}
              {!isStaff ? <DetailRow label="Outstanding">{formatNGN(outstanding)}</DetailRow> : null}
              <DetailRow label="Next follow-up">{formatDate(prospect.next_follow_up_at)}</DetailRow>
              <DetailRow label="Added">{formatDate(prospect.created_at)}</DetailRow>
            </dl>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader title="Assignment" />
              <div className="p-4">
                <p className="text-sm">{one(prospect.assigned as { full_name: string } | { full_name: string }[] | null)?.full_name ?? 'Unassigned'}</p>
                {!isStaff ? (
                  <ActionForm action={assignRecord} className="mt-3 flex gap-2">
                    <input type="hidden" name="record_type" value="prospect" />
                    <input type="hidden" name="record_id" value={prospect.id} />
                    <Select name="staff_id" aria-label="Assign to" defaultValue={prospect.assigned_to ?? ''}>
                      <option value="">Unassigned</option>
                      {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </Select>
                    <Button type="submit" variant="ghost">Assign</Button>
                  </ActionForm>
                ) : null}
              </div>
            </Card>
            <Card>
              <CardHeader title="Next steps" />
              <div className="space-y-2 p-4">
                <LinkButton href="/deals" variant="ghost" className="w-full">Go to deals</LinkButton>
                <p className="text-[11px] text-muted">Create a deal from the Deals page and link it to this prospect.</p>
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === 'history' ? (
        <Card>
          <CardHeader title="Prospect history" subtitle="Everything recorded against this prospect, newest first" />
          <ol className="divide-y divide-line/60">
            {history.map((h, i) => (
              <li key={i} className="flex gap-4 px-4 py-3 text-sm">
                <span className="w-24 shrink-0 text-xs text-muted">{formatDate(h.at)}</span>
                <span className="min-w-0"><span className="block">{h.title}</span>{h.detail ? <span className="block break-words text-xs text-muted">{h.detail}</span> : null}</span>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {tab === 'outreach' ? (
        <Card>
          <CardHeader title="Outreach history" subtitle={`${outreach.length} records`} />
          {!outreach.length ? <EmptyState title="No outreach recorded" hint="Use “Record outreach” above after you contact this prospect." /> : (
            <Table minWidth={720}>
              <thead><tr><TH>Date</TH><TH>Channel</TH><TH>Direction</TH><TH>Outcome</TH><TH>By</TH><TH>Summary</TH></tr></thead>
              <tbody>
                {outreach.map((o) => (
                  <tr key={o.id}>
                    <TD className="text-xs">{formatDate(o.contacted_at)}</TD>
                    <TD>{label(o.channel)}</TD>
                    <TD className="text-muted">{label(o.direction)}</TD>
                    <TD><Badge>{label(o.outcome ?? 'no_response')}</Badge></TD>
                    <TD className="text-xs text-muted">{one(o.creator as { full_name: string } | { full_name: string }[] | null)?.full_name ?? '—'}</TD>
                    <TD className="max-w-xs text-xs text-muted">{o.message_summary}</TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      ) : null}

      {tab === 'deals' ? (
        <Card>
          <CardHeader title="Deals" action={<LinkButton href="/deals" variant="subtle" size="sm">Open deals</LinkButton>} />
          {!deals.length ? <EmptyState title="No deals for this prospect" /> : (
            <Table minWidth={560}>
              <thead><tr><TH>Deal</TH><TH>Stage</TH><TH>Value</TH><TH>Created</TH></tr></thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d.id}>
                    <TD><Link href={`/deals/${d.id}`} className="font-medium hover:text-gold">{d.title}</Link></TD>
                    <TD><Badge tone={dealTone[d.status]}>{label(d.status)}</Badge></TD>
                    <TD className="tabular-nums">{formatNGN(d.deal_value)}</TD>
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
          {!tasks.length ? <EmptyState title="No tasks for this prospect" /> : (
            <Table minWidth={560}>
              <thead><tr><TH>Task</TH><TH>Priority</TH><TH>Due</TH><TH>Assignee</TH><TH>Status</TH></tr></thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <TD>{t.title}</TD>
                    <TD><Badge tone={priorityTone[t.priority]}>{t.priority}</Badge></TD>
                    <TD className="text-xs">{formatDate(t.due_at)}</TD>
                    <TD className="text-xs text-muted">{one(t.assignee as { full_name: string } | { full_name: string }[] | null)?.full_name ?? 'Unassigned'}</TD>
                    <TD><Badge tone={taskTone[t.status]}>{label(t.status)}</Badge></TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      ) : null}

      {tab === 'notes' ? (
        <Card className="p-5"><p className="whitespace-pre-wrap text-sm text-muted">{prospect.notes || 'No notes recorded. Use Edit to add notes.'}</p></Card>
      ) : null}
    </>
  );
}
