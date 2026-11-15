import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatNGN, formatDate } from '@/lib/utils';
import { Card, Table, TH, TD, EmptyState, Badge, Input, Select, Button, Textarea } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { ProspectForm } from '@/components/forms';
import { saveProspect, importProspectsCSV } from '@/actions/prospects';
import { PROSPECT_STATUSES, label } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const toneMap: Record<string, 'neutral' | 'gold' | 'green' | 'red' | 'blue' | 'amber'> = {
  new: 'blue', contacted: 'neutral', responded: 'blue', interested: 'gold',
  qualified: 'gold', converted: 'green', disqualified: 'red', on_hold: 'amber'
};

export default async function ProspectsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; industry?: string; staff?: string; sort?: string }> }) {
  await requireProfile();
  const sp = await searchParams;
  const supabase = await createClient();

  let query = supabase.from('prospects').select('*, assigned_profile:profiles!prospects_assigned_to_fkey(full_name)').order(sp.sort === 'company' ? 'company_name' : 'created_at', { ascending: sp.sort === 'company' });

  if (sp.q) query = query.or(`company_name.ilike.%${sp.q}%,contact_name.ilike.%${sp.q}%,email.ilike.%${sp.q}%`);
  if (sp.status) query = query.eq('status', sp.status);
  if (sp.industry) query = query.eq('industry', sp.industry);
  if (sp.staff) query = query.eq('assigned_to', sp.staff);

  const [{ data: prospects, error }, { data: staffList }, { data: industries }] = await Promise.all([
    query.limit(200),
    supabase.from('profiles').select('id, full_name, email').eq('is_active', true),
    supabase.from('prospects').select('industry').not('industry', 'eq', '')
  ]);

  const staff = (staffList ?? []).map((s) => ({ id: s.id, name: s.full_name || s.email }));
  const industryList = [...new Set((industries ?? []).map((i) => i.industry))];

  return (
    <>
      <PageHeader title="Prospects" description="Your CRM pipeline of businesses." />
      <ProspectForm action={saveProspect} staff={staff} />

      {error ? <p className="mb-4 rounded-md border border-red-900 bg-red-950/30 px-3 py-2 text-xs text-red-400">Could not load prospects: {error.message}</p> : null}

      <Card className="mb-4 p-4">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input name="q" placeholder="Search company, contact, email…" defaultValue={sp.q ?? ''} />
          <Select name="status" defaultValue={sp.status ?? ''}>
            <option value="">All statuses</option>
            {PROSPECT_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </Select>
          <Select name="industry" defaultValue={sp.industry ?? ''}>
            <option value="">All industries</option>
            {industryList.map((i) => <option key={i} value={i}>{i}</option>)}
          </Select>
          <Select name="staff" defaultValue={sp.staff ?? ''}>
            <option value="">All staff</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <div className="flex gap-2">
            <Select name="sort" defaultValue={sp.sort ?? 'date'}>
              <option value="date">Newest first</option>
              <option value="company">Company A–Z</option>
            </Select>
            <Button type="submit" variant="ghost">Filter</Button>
          </div>
        </form>
      </Card>

      <Card>
        {!(prospects ?? []).length ? <EmptyState title="No prospects found" hint="Add your first prospect or adjust filters." /> : (
          <Table>
            <thead><tr><TH>Company</TH><TH>Contact</TH><TH>Status</TH><TH>Est. value</TH><TH>Assigned</TH><TH>Follow-up</TH></tr></thead>
            <tbody>
              {(prospects ?? []).map((p) => (
                <tr key={p.id} className="hover:bg-surface-2/60">
                  <TD><Link href={`/prospects/${p.id}`} className="font-medium hover:text-gold">{p.company_name}</Link><p className="text-xs text-muted">{p.industry}</p></TD>
                  <TD><p>{p.contact_name || '—'}</p><p className="text-xs text-muted">{p.email || p.phone || ''}</p></TD>
                  <TD><Badge tone={toneMap[p.status]}>{label(p.status)}</Badge></TD>
                  <TD className="tabular-nums">{formatNGN(p.estimated_value)}</TD>
                  <TD className="text-xs text-muted">{p.assigned_profile?.full_name ?? 'Unassigned'}</TD>
                  <TD className="text-xs">{formatDate(p.next_follow_up_at)}</TD>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-2 text-sm font-semibold">Import prospects from CSV</h3>
          <p className="mb-3 text-xs text-muted">Headers: company name, contact name, industry, phone, email, website, location, source, estimated value</p>
          <form action={importProspectsCSV} className="space-y-3">
            <Textarea name="csv" placeholder={'company name,contact name,industry,phone,email\nAcme Ltd,John Tech,software,080…,john@acme.com'} className="font-mono text-xs" />
            <Button type="submit" variant="ghost">Import CSV</Button>
          </form>
        </Card>
        <Card className="p-5">
          <h3 className="mb-2 text-sm font-semibold">Export</h3>
          <p className="mb-3 text-xs text-muted">Download the full prospect list as CSV.</p>
          <a href="/api/export?type=prospects"><Button variant="ghost">Export prospects CSV</Button></a>
        </Card>
      </div>
    </>
  );
}
