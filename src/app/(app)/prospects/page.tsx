import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatNGN, formatDate } from '@/lib/utils';
import { Card, Table, TH, TD, EmptyState, Badge, ErrorState, LinkButton } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { FilterBar } from '@/components/filter-bar';
import { Pagination } from '@/components/pagination';
import { ProspectDialog } from '@/components/forms';
import { CsvImportDialog } from '@/components/csv-import';
import { saveProspect, importProspectsCSV } from '@/actions/prospects';
import { PROSPECT_STATUSES, label } from '@/lib/constants';
import { PAGE_SIZE, pageParam, rangeFor, safeSearch, one, prospectTone } from '@/lib/ui-helpers';

export const metadata: Metadata = { title: 'Prospects', description: 'CRM pipeline of prospective clients.' };
export const dynamic = 'force-dynamic';

type SP = { q?: string; status?: string; source?: string; staff?: string; sort?: string; page?: string };

export default async function ProspectsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const profile = await requireProfile();
  const sp = await searchParams;
  const supabase = await createClient();
  const page = pageParam(sp.page);
  const [from, to] = rangeFor(page);
  const q = safeSearch(sp.q);

  let query = supabase
    .from('prospects')
    .select('id, company_name, contact_name, industry, email, phone, whatsapp_link, email_link, telegram_link, prefilled_message, status, source, estimated_value, next_follow_up_at, assigned_to, assigned:profiles!prospects_assigned_to_fkey(full_name)', { count: 'exact' })
    .order(sp.sort === 'company' ? 'company_name' : sp.sort === 'value' ? 'estimated_value' : 'created_at', { ascending: sp.sort === 'company' });

  if (q) query = query.or(`company_name.ilike.%${q}%,contact_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
  if (sp.status && (PROSPECT_STATUSES as readonly string[]).includes(sp.status)) query = query.eq('status', sp.status);
  if (sp.source) query = query.eq('source', sp.source);
  if (sp.staff === 'unassigned') query = query.is('assigned_to', null);
  else if (sp.staff) query = query.eq('assigned_to', sp.staff);

  const [{ data: prospects, count, error }, { data: staffList }, { data: sources }] = await Promise.all([
    query.range(from, to),
    supabase.from('profiles').select('id, full_name, email').eq('is_active', true),
    supabase.from('prospects').select('source').not('source', 'is', null).neq('source', '')
  ]);

  const staff = (staffList ?? []).map((s) => ({ id: s.id, name: s.full_name || s.email }));
  const sourceList = [...new Set((sources ?? []).map((s) => s.source as string))].sort();
  const isStaff = profile.role === 'staff';
  const rows = prospects ?? [];

  return (
    <>
      <PageHeader title="Prospects" description={isStaff ? 'Prospects you created or are assigned to.' : 'Every business in the Vector Codes pipeline.'}>
        <LinkButton href="/api/export?type=prospects" variant="ghost">Export CSV</LinkButton>
        <CsvImportDialog action={importProspectsCSV} />
        <ProspectDialog action={saveProspect} staff={staff} canAssign={!isStaff} />
      </PageHeader>

      <FilterBar
        basePath="/prospects"
        values={{ q: sp.q, status: sp.status, source: sp.source, staff: sp.staff, sort: sp.sort }}
        filters={[
          { kind: 'search', name: 'q', placeholder: 'Search company, contact, email or phone…' },
          { kind: 'select', name: 'status', label: 'Status', options: PROSPECT_STATUSES.map((s) => ({ value: s, label: label(s) })) },
          { kind: 'select', name: 'source', label: 'Source', options: sourceList.map((s) => ({ value: s, label: s })) },
          ...(isStaff ? [] : [{ kind: 'select' as const, name: 'staff', label: 'Assigned to', options: [{ value: 'unassigned', label: 'Unassigned' }, ...staff.map((s) => ({ value: s.id, label: s.name }))] }]),
          { kind: 'select', name: 'sort', label: 'Sort', options: [{ value: 'company', label: 'Company A–Z' }, { value: 'value', label: 'Highest value' }] }
        ]}
      />

      {error ? <ErrorState title="Could not load prospects" message={error.message} /> : null}

      <Card>
        {!rows.length && !error ? (
          <EmptyState
            title={q || sp.status || sp.source || sp.staff ? 'No prospects match these filters' : 'No prospects yet'}
            hint={q || sp.status || sp.source || sp.staff ? 'Try clearing a filter.' : 'Add your first prospect or import a CSV to get started.'}
          />
        ) : (
          <>
            <Table minWidth={820}>
              <thead>
                <tr><TH>Company</TH><TH>Contact</TH><TH>Contact actions</TH><TH>Status</TH><TH>Source</TH><TH>Est. value</TH><TH>Assigned</TH><TH>Follow-up</TH></tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const message = p.prefilled_message || `Hello ${p.contact_name || 'there'}, I’m reaching out regarding ${p.company_name}. I’m with Vector Codes and would love to discuss how we could help your business.`;
                  const waRaw: string = p.whatsapp_link || p.phone || '';
                  const wa = waRaw ? (waRaw.startsWith('http') ? (waRaw.includes('?') ? waRaw : `${waRaw}?${new URLSearchParams({ text: message })}`) : `https://wa.me/${waRaw.split('').filter((ch: string) => ch >= '0' && ch <= '9').join('').replace(/^0/, '234')}?${new URLSearchParams({ text: message })}`) : '';
                  const emailRaw = p.email_link || p.email || '';
                  const mail = emailRaw ? (emailRaw.startsWith('mailto:') ? (emailRaw.includes('?') ? emailRaw : `${emailRaw}?subject=${encodeURIComponent('A quick introduction from Vector Codes')}&body=${encodeURIComponent(message)}`) : `mailto:${emailRaw}?subject=${encodeURIComponent('A quick introduction from Vector Codes')}&body=${encodeURIComponent(message)}`) : '';
                  const telegramRaw = p.telegram_link || '';
                  const telegram = telegramRaw ? (telegramRaw.startsWith('http') ? (telegramRaw.includes('?') ? telegramRaw : `${telegramRaw}?text=${encodeURIComponent(message)}`) : `https://t.me/${telegramRaw.replace(/^@/, '')}?text=${encodeURIComponent(message)}`) : '';
                  const overdue = p.next_follow_up_at && p.next_follow_up_at < new Date().toISOString() && !['converted', 'disqualified'].includes(p.status);
                  return (
                    <tr key={p.id} className="hover:bg-surface-2/60">
                      <TD>
                        <Link href={`/prospects/${p.id}`} className="font-medium hover:text-gold">{p.company_name}</Link>
                        {p.industry ? <p className="text-xs text-muted">{p.industry}</p> : null}
                      </TD>
                      <TD><p>{p.contact_name || '—'}</p><p className="text-xs text-muted">{p.email || p.phone || ''}</p></TD>
                      <TD><div className="flex flex-wrap gap-2 text-xs">
                        {wa ? <a href={wa} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">WhatsApp</a> : null}
                        {mail ? <a href={mail.includes('?') ? mail : `${mail}?subject=${encodeURIComponent('A quick introduction from Vector Codes')}&body=${encodeURIComponent(message)}`} className="text-sky-600 hover:underline">Email</a> : null}
                        {telegram ? <a href={telegram.includes('?') ? telegram : `${telegram}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Telegram</a> : null}
                      </div></TD>
                      <TD><Badge tone={prospectTone[p.status]}>{label(p.status)}</Badge></TD>
                      <TD className="text-xs text-muted">{p.source || '—'}</TD>
                      <TD className="tabular-nums">{formatNGN(p.estimated_value)}</TD>
                      <TD className="text-xs text-muted">{one(p.assigned as { full_name: string } | { full_name: string }[] | null)?.full_name ?? 'Unassigned'}</TD>
                      <TD className={`text-xs ${overdue ? 'text-danger' : ''}`}>{formatDate(p.next_follow_up_at)}{overdue ? ' · overdue' : ''}</TD>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination basePath="/prospects" page={page} pageSize={PAGE_SIZE} total={count ?? rows.length} params={{ q: sp.q, status: sp.status, source: sp.source, staff: sp.staff, sort: sp.sort }} />
          </>
        )}
      </Card>
    </>
  );
}
