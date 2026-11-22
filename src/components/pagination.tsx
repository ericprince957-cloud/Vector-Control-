import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** URL-driven pagination; preserves the other query parameters. */
export function Pagination({ basePath, page, pageSize, total, params }: {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) {
    return <p className="px-4 py-3 text-xs text-muted">{total} {total === 1 ? 'record' : 'records'}</p>;
  }
  const href = (p: number) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v && k !== 'page') sp.set(k, v); });
    if (p > 1) sp.set('page', String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const linkClass = 'inline-flex min-h-8 items-center gap-1 rounded-[5px] border border-line-strong px-3 text-xs hover:border-gold/60 hover:text-gold';
  const disabled = 'inline-flex min-h-8 items-center gap-1 rounded-[5px] border border-line px-3 text-xs text-muted/40';
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
      <p className="text-xs text-muted">{from}–{to} of {total}</p>
      <div className="flex items-center gap-2">
        {page > 1 ? <Link href={href(page - 1)} className={linkClass}><ChevronLeft size={14} aria-hidden /> Previous</Link> : <span className={disabled}><ChevronLeft size={14} aria-hidden /> Previous</span>}
        <span className="text-xs text-muted">Page {page} of {pages}</span>
        {page < pages ? <Link href={href(page + 1)} className={linkClass}>Next <ChevronRight size={14} aria-hidden /></Link> : <span className={disabled}>Next <ChevronRight size={14} aria-hidden /></span>}
      </div>
    </nav>
  );
}
