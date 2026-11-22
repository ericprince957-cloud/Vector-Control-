'use client';

import { Button, Card } from '@/components/ui';

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card className="mx-auto mt-10 max-w-lg p-8 text-center" role="alert">
      <h1 className="text-lg font-semibold">This page could not be loaded</h1>
      <p className="mt-2 text-sm text-muted">
        Something went wrong while loading your data. Your records are safe. Try again, and if the problem continues contact the founder.
      </p>
      {error.digest ? <p className="mt-2 text-[11px] text-muted/60">Reference: {error.digest}</p> : null}
      <Button className="mt-6" onClick={reset}>Try again</Button>
    </Card>
  );
}
