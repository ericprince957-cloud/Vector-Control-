import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { Card, Table, TH, TD, EmptyState, Badge, Select, Button } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { OutreachForm } from '@/components/forms';
import { saveOutreach } from '@/actions/outreach';
import { OUTREACH_CHANNELS, OUTREACH_OUTCOMES, label } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function OutreachPage({ searchParams }: { searchParams: Promise<{ channel?: string; staff?: string; outcome?: string }> }) {
  await requireProfile();
  const sp = await searchParams;
  const supabase = await createClient();

  let query = supabase.from('outreach_activities').select('*, prospect:prospects(company_name), creator:profiles!outreach_activities_created_by_fkey(full_name)').order('contacted_at', { ascending: false }).limit(200);
  if (sp.channel) query = query.eq('channel', sp.channel);
  if (sp.outcome) query = query.eq('outcome', sp.outcome);
  if (sp.staff) query = query.eq('created_by', sp.staff);

  const [{ data: records }, { data: prospects }, { data: staffList }] = await Promise.all([
    query,
    supabase.from('prospects').select('id, company_name').order('company_name'),
    supabase.from('profiles').select('id, full_name, email').eq('is_active', true)
  ]);

  const staff = (staffList ?? []).map((s) => ({ id: s.id, name: s.full_name || s.email }));
  const list = records ?? [];
  const noResponse = list.filter((r) => r.outcome === 'no_response').length;
  const followUp = list.filter((r) => r.outcome === 'follow_up_required').length;

  return (
    <>
      <PageHeader title="Outreach" description={`${list.length} records · ${noResponse} without response · ${followUp} need follow-up`} />
      <OutreachForm action={saveOutreach} prospects={prospects ?? []} />

      <Card className="mb-4 p-4">
        <form className="grid gap-3 sm:grid-cols-4">
          <Select name="channel" defaultValue={sp.channel ?? ''}>
            <option value="">All channels</option>
            {OUTREACH_CHANNELS.map((c) => <option key={c} value={c}>{label(c)}</option>)}
          </Select>
          <Select name="outcome" defaultValue={sp.outcome ?? ''}>
            <option value="">All outcomes</option>
            {OUTREACH_OUTCOMES.map((o) => <option key={o} value={o}>{label(o)}</option>)}
          </Select>
          <Select name="staff" defaultValue={sp.staff ?? ''}>
            <option value="">All staff</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Button type="submit" variant="ghost">Filter</Button>
        </form>
      </Card>

      <Card>
        {!list.length ? <EmptyState title="No outreach records" hint="Record your first outreach above." /> : (
          <Table>
            <thead><tr><TH>Date</TH><TH>Prospect</TH><TH>Channel</TH><TH>Outcome</TH><TH>Recorded by</TH><TH>Follow-up</TH></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="hover:bg-surface-2/60">
                  <TD className="text-xs">{formatDate(r.contacted_at)}</TD>
                  <TD className="font-medium">{r.prospect?.company_name ?? '—'}</TD>
                  <TD className="capitalize">{r.channel}</TD>
                  <TD><Badge tone={r.outcome === 'interested' ? 'gold' : r.outcome === 'not_interested' ? 'red' : 'neutral'}>{label(r.outcome)}</Badge></TD>
                  <TD className="text-xs text-muted">{r.creator?.full_name ?? '—'}</TD>
                  <TD className="text-xs">{formatDate(r.next_follow_up_at)}</TD>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <p className="mt-3 text-[11px] text-muted/60">
        Note: Vector Control logs outreach activity. WhatsApp/Telegram messages are sent manually from your own devices — this system does not send messages on your behalf.
      </p>
    </>
  );
}
