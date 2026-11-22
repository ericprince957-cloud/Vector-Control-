import { Card } from './ui';

export function AuthFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[5px] bg-gold text-lg font-bold text-black">V</div>
        <div className="leading-tight">
          <p className="text-base font-semibold tracking-wide">Vector Control</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted">Vector Codes</p>
        </div>
      </div>
      <Card className="w-full max-w-md p-7">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </Card>
      <p className="mt-6 max-w-md text-center text-[11px] text-muted/70">
        Private system. Access is restricted to authorized Vector Codes personnel.
      </p>
    </main>
  );
}
