'use client';

import { Upload } from 'lucide-react';
import { FormDialog } from './form-dialog';
import { Field } from './ui';
import type { ActionState } from '@/lib/validators';

export function CsvImportDialog({ action }: { action: (fd: FormData) => Promise<ActionState> }) {
  return (
    <FormDialog
      title="Import prospects"
      description="Upload a CSV or Excel workbook (.xlsx). The first worksheet must have a header row. Columns are matched by their names, so their order does not matter."
      triggerLabel="Import CSV / Excel"
      triggerVariant="ghost"
      icon="none"
      action={action}
      submitLabel="Import prospects"
    >
      <div className="space-y-3">
        <Field label="Choose file *">
          <label htmlFor="prospect-import-file" className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong px-4 py-5 text-center text-sm hover:border-gold/60">
            <Upload size={20} aria-hidden />
            <span className="font-medium">Choose CSV or Excel file</span>
            <span className="text-xs text-muted">.csv or .xlsx · Maximum 10 MB</span>
          </label>
          <input id="prospect-import-file" name="file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required className="sr-only" />
        </Field>
        <div className="rounded-lg bg-surface-2 p-3 text-xs text-muted">
          <p className="mb-1 font-medium text-foreground">Recognised columns</p>
          Company Name, Contact Name, Phone, Email, WhatsApp Link, Email Link, Telegram Link, Prefilled Message, Industry, Website, Location, Source, Estimated Value.
          <p className="mt-2">Header names can use spaces or underscores. Column order does not matter. Rows without a company name are skipped.</p>
        </div>
      </div>
    </FormDialog>
  );
}
