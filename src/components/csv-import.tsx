'use client';

import { useRef } from 'react';
import { Upload } from 'lucide-react';
import { FormDialog } from './form-dialog';
import { Textarea, Field } from './ui';
import type { ActionState } from '@/lib/validators';

/** Lets the user paste CSV text or load a .csv file into the textarea before importing. */
export function CsvImportDialog({ action }: { action: (fd: FormData) => Promise<ActionState> }) {
  const areaRef = useRef<HTMLTextAreaElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !areaRef.current) return;
    areaRef.current.value = await file.text();
  }

  return (
    <FormDialog
      title="Import prospects from CSV"
      description="Header row required. Recognised columns: company name, contact name, industry, phone, email, website, location, source, estimated value."
      triggerLabel="Import CSV"
      triggerVariant="ghost"
      icon="none"
      action={action}
      submitLabel="Import"
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="csv-file" className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[5px] border border-line-strong px-4 text-sm hover:border-gold/60 hover:text-gold">
            <Upload size={15} aria-hidden /> Choose .csv file
          </label>
          <input id="csv-file" type="file" accept=".csv,text/csv" onChange={onFile} className="sr-only" />
        </div>
        <Field label="CSV content">
          <Textarea ref={areaRef} name="csv" required className="min-h-48 font-mono text-xs" placeholder={'company name,contact name,industry,phone,email\nAcme Ltd,John Tech,software,080…,john@acme.com'} />
        </Field>
        <p className="text-[11px] text-muted">Imported rows are added as new prospects. Simple comma-separated values only — wrap nothing in quotes that contains a comma.</p>
      </div>
    </FormDialog>
  );
}
