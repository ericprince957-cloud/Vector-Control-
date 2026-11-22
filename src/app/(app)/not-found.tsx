import Link from 'next/link';
import { Card } from '@/components/ui';

export default function NotFound() {
  return (
    <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
      <h1 className="text-lg font-semibold">Record not found</h1>
      <p className="mt-2 text-sm text-muted">It may have been removed, or you may not have permission to view it.</p>
      <Link href="/overview" className="mt-6 inline-block text-sm text-gold hover:text-gold-light">Back to overview</Link>
    </Card>
  );
}
