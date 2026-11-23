import Link from 'next/link';
import { Search } from 'lucide-react';
import { Button, Card, Input, Select } from './ui';

export type FilterDef =
  | { kind: 'search'; name: string; placeholder: string }
  | { kind: 'select'; name: string; label: string; options: { value: string; label: string }[] }
  | { kind: 'date'; name: string; label: string };

/**
 * GET-form filter bar. State lives in the URL, so filtered views are
 * shareable, work without client JavaScript, and stay server-rendered.
 */
export function FilterBar({ basePath, filters, values, hidden }: {
  basePath: string;
  filters: FilterDef[];
  values: Record<string, string | undefined>;
  /** Extra query params kept when the form is submitted (e.g. the current tab). */
  hidden?: Record<string, string | undefined>;
}) {
  const active = filters.some((f) => values[f.name]);
  return (
    <Card className="mb-4 p-3">
      <form method="get" action={basePath} className="flex flex-wrap items-end gap-3">
        {Object.entries(hidden ?? {}).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
        {filters.map((f) => {
          if (f.kind === 'search') {
            return (
              <div key={f.name} className="min-w-[14rem] flex-1">
                <label htmlFor={`f-${f.name}`} className="sr-only">{f.placeholder}</label>
                <div className="relative">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
                  <Input id={`f-${f.name}`} name={f.name} defaultValue={values[f.name] ?? ''} placeholder={f.placeholder} className="pl-9" />
                </div>
              </div>
            );
          }
          if (f.kind === 'select') {
            return (
              <div key={f.name} className="min-w-[9rem]">
                <label htmlFor={`f-${f.name}`} className="mb-1 block text-[11px] text-muted">{f.label}</label>
                <Select id={`f-${f.name}`} name={f.name} defaultValue={values[f.name] ?? ''}>
                  <option value="">All</option>
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </div>
            );
          }
          return (
            <div key={f.name} className="min-w-[9rem]">
              <label htmlFor={`f-${f.name}`} className="mb-1 block text-[11px] text-muted">{f.label}</label>
              <Input id={`f-${f.name}`} name={f.name} type="date" defaultValue={values[f.name] ?? ''} />
            </div>
          );
        })}
        <div className="flex gap-2">
          <Button type="submit" variant="ghost">Apply</Button>
          {active ? <Link href={basePath} className="inline-flex min-h-10 items-center px-2 text-xs text-muted hover:text-gold">Clear</Link> : null}
        </div>
      </form>
    </Card>
  );
}
