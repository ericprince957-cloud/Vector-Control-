import type { Metadata } from 'next';
import Link from 'next/link';
import { requireFinanceAccess } from '@/lib/auth';
import { Card, CardHeader, Badge } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { Landmark, ShieldCheck, ArrowDownLeft, ArrowUpRight, RefreshCw, FileSpreadsheet, LockKeyhole, ExternalLink, Clock3 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Banking',
  description: 'Bank account connection and transaction monitoring.',
};
export const dynamic = 'force-dynamic';

export default async function BankingPage() {
  await requireFinanceAccess();

  return (
    <>
      <PageHeader
        title="Banking"
        description="Monitor an authorized bank connection alongside Vector Codes finances."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs">Available balance</span>
            <Landmark size={17} />
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">Not connected</p>
          <p className="mt-1 text-xs text-muted">No live balance is being retrieved</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs">Money received</span>
            <ArrowDownLeft size={17} className="text-success" />
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">—</p>
          <p className="mt-1 text-xs text-muted">Awaiting transaction data</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs">Money spent</span>
            <ArrowUpRight size={17} className="text-danger" />
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">—</p>
          <p className="mt-1 text-xs text-muted">Awaiting transaction data</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs">Last synchronized</span>
            <RefreshCw size={17} />
          </div>
          <p className="mt-3 text-2xl font-semibold">Never</p>
          <p className="mt-1 text-xs text-muted">No bank connection established</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader
            title="Connected accounts"
            subtitle="Only accounts authorized through an official integration will appear here."
          />
          <div className="p-4">
            <div className="rounded-md border border-line bg-surface-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-md border border-line bg-surface">
                    <Landmark size={21} className="text-gold" />
                  </div>
                  <div>
                    <p className="font-semibold">Moniepoint Personal</p>
                    <p className="text-xs text-muted">Personal account · Nigeria</p>
                  </div>
                </div>
                <Badge tone="amber">Not connected</Badge>
              </div>
              <div className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-2">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <ShieldCheck size={15} className="text-success" />
                  Read-only access required
                </div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <LockKeyhole size={15} />
                  No PIN, password or OTP stored
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-muted">
                Direct access for Moniepoint Personal accounts has not yet been confirmed.
                We will only activate a connection after Moniepoint or an approved Open Banking
                provider confirms that balance and transaction data are available for your account.
              </p>
              <Link
                href="https://support.moniepoint.com/"
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-gold/50 px-3 py-2 text-xs font-semibold text-gold transition-colors hover:bg-gold/10"
              >
                Contact Moniepoint support <ExternalLink size={14} />
              </Link>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Connection safeguards" subtitle="Required before any bank data is synchronized." />
          <div className="space-y-4 p-4">
            {[
              ['Read-only permissions', 'Balance and transaction history only.'],
              ['Explicit account consent', 'You approve the connection with the bank or regulated provider.'],
              ['Server-side credentials', 'Secrets stay in protected server environment variables.'],
              ['Founder-only access', 'Banking information is restricted to finance-authorized users.'],
              ['Revocable access', 'The connection can be disconnected and its consent revoked.'],
            ].map(([title, description]) => (
              <div key={title} className="flex gap-3">
                <ShieldCheck size={17} className="mt-0.5 shrink-0 text-success" />
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Bank transactions"
          subtitle="Incoming and outgoing bank activity will appear here after an approved connection or statement import is implemented."
        />
        <div className="flex flex-col items-center px-5 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface-2">
            <FileSpreadsheet size={21} className="text-muted" />
          </div>
          <h2 className="mt-4 text-sm font-semibold">No bank transactions yet</h2>
          <p className="mt-1 max-w-lg text-xs leading-5 text-muted">
            This section is intentionally empty until real statement data can be imported safely
            or Moniepoint provides an approved account-information connection. No sample figures
            are shown as real money.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-[11px] text-muted">
            <Clock3 size={13} /> Statement import and duplicate detection are planned next
          </div>
        </div>
      </Card>
    </>
  );
}
