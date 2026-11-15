'use client';

import { CollapsibleForm } from './collapsible-form';
import { Field, Input, Select, Textarea } from './ui';
import {
  PROSPECT_STATUSES, OUTREACH_CHANNELS, OUTREACH_OUTCOMES, DEAL_STATUSES,
  PROJECT_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES, REJECTION_REASONS, TASK_PRIORITIES
} from '@/lib/constants';

type Opt = { id: string; name: string };
const opts = (list: readonly string[]) => list.map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>);
const people = (list: Opt[]) => list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>);

export function ProspectForm({ action, staff }: { action: (fd: FormData) => Promise<{ ok: boolean; message: string }>; staff: Opt[] }) {
  return (
    <CollapsibleForm title="Add prospect" action={action}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Company name *"><Input name="company_name" required /></Field>
        <Field label="Contact person"><Input name="contact_name" /></Field>
        <Field label="Industry"><Input name="industry" /></Field>
        <Field label="Phone"><Input name="phone" /></Field>
        <Field label="WhatsApp"><Input name="whatsapp" /></Field>
        <Field label="Email"><Input name="email" type="email" /></Field>
        <Field label="Website"><Input name="website" /></Field>
        <Field label="Location"><Input name="location" /></Field>
        <Field label="Lead source"><Input name="lead_source" placeholder="referral, twitter, cold outreach…" /></Field>
        <Field label="Estimated budget (₦)"><Input name="estimated_budget" type="number" min="0" step="0.01" defaultValue="0" /></Field>
        <Field label="Assigned staff"><Select name="assigned_to"><option value="">— Unassigned —</option>{people(staff)}</Select></Field>
        <Field label="Status"><Select name="status" defaultValue="new">{opts(PROSPECT_STATUSES)}</Select></Field>
        <Field label="Next follow-up"><Input name="next_follow_up_date" type="date" /></Field>
        <div className="sm:col-span-2 lg:col-span-3"><Field label="Notes"><Textarea name="notes" /></Field></div>
      </div>
    </CollapsibleForm>
  );
}

export function OutreachForm({ action, prospects, staff }: { action: (fd: FormData) => Promise<{ ok: boolean; message: string }>; prospects: Opt[]; staff: Opt[] }) {
  return (
    <CollapsibleForm title="Record outreach" action={action}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Prospect *"><Select name="prospect_id" required><option value="">— Select —</option>{people(prospects)}</Select></Field>
        <Field label="Channel"><Select name="channel" defaultValue="whatsapp">{opts(OUTREACH_CHANNELS)}</Select></Field>
        <Field label="Direction"><Select name="direction" defaultValue="outbound">{opts(['outbound', 'inbound'])}</Select></Field>
        <Field label="Date & time"><Input name="occurred_at" type="datetime-local" required /></Field>
        <Field label="Outcome"><Select name="outcome" defaultValue="no_response">{opts(OUTREACH_OUTCOMES)}</Select></Field>
        <Field label="Staff member"><Select name="staff_id"><option value="">— Me —</option>{people(staff)}</Select></Field>
        <Field label="Next follow-up"><Input name="next_follow_up_date" type="date" /></Field>
        <div className="sm:col-span-2"><Field label="Message summary"><Input name="summary" /></Field></div>
        <div className="sm:col-span-2 lg:col-span-3"><Field label="Response received"><Textarea name="response" /></Field></div>
      </div>
    </CollapsibleForm>
  );
}

export function DealForm({ action, prospects, staff }: { action: (fd: FormData) => Promise<{ ok: boolean; message: string }>; prospects: Opt[]; staff: Opt[] }) {
  return (
    <CollapsibleForm title="Create deal" action={action}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Deal title *"><Input name="title" required /></Field>
        <Field label="Prospect *"><Select name="prospect_id" required><option value="">— Select —</option>{people(prospects)}</Select></Field>
        <Field label="Service offered"><Input name="service" /></Field>
        <Field label="Quoted amount (₦)"><Input name="quoted_amount" type="number" min="0" step="0.01" defaultValue="0" /></Field>
        <Field label="Negotiated amount (₦)"><Input name="negotiated_amount" type="number" min="0" step="0.01" /></Field>
        <Field label="Expected close date"><Input name="expected_close_date" type="date" /></Field>
        <Field label="Assigned staff"><Select name="assigned_to"><option value="">— Unassigned —</option>{people(staff)}</Select></Field>
        <Field label="Status"><Select name="status" defaultValue="draft">{opts(DEAL_STATUSES)}</Select></Field>
        <div className="sm:col-span-2 lg:col-span-3"><Field label="Description"><Textarea name="description" /></Field></div>
        <div className="sm:col-span-2 lg:col-span-3"><Field label="Proposal notes"><Textarea name="proposal_notes" /></Field></div>
        <div className="sm:col-span-2 lg:col-span-3"><Field label="Contract notes"><Textarea name="contract_notes" /></Field></div>
      </div>
    </CollapsibleForm>
  );
}

export function ProjectForm({ action, deals, staff }: { action: (fd: FormData) => Promise<{ ok: boolean; message: string }>; deals: Opt[]; staff: Opt[] }) {
  return (
    <CollapsibleForm title="Create project" action={action}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Project name *"><Input name="name" required /></Field>
        <Field label="Client"><Input name="client_name" /></Field>
        <Field label="Related deal"><Select name="deal_id"><option value="">— None —</option>{people(deals)}</Select></Field>
        <Field label="Contract amount (₦)"><Input name="contract_amount" type="number" min="0" step="0.01" defaultValue="0" /></Field>
        <Field label="Start date"><Input name="start_date" type="date" /></Field>
        <Field label="Deadline"><Input name="deadline" type="date" /></Field>
        <Field label="Assigned to"><Select name="assigned_to"><option value="">— Unassigned —</option>{people(staff)}</Select></Field>
        <Field label="Status"><Select name="status" defaultValue="not_started">{opts(PROJECT_STATUSES)}</Select></Field>
        <div className="sm:col-span-2 lg:col-span-3"><Field label="Description"><Textarea name="description" /></Field></div>
        <div className="sm:col-span-2 lg:col-span-3"><Field label="Progress notes"><Textarea name="progress_notes" /></Field></div>
      </div>
    </CollapsibleForm>
  );
}

export function PaymentForm({ action, deals }: { action: (fd: FormData) => Promise<{ ok: boolean; message: string }>; deals: Opt[] }) {
  return (
    <CollapsibleForm title="Record payment" action={action}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Amount (₦) *"><Input name="amount" type="number" min="0.01" step="0.01" required /></Field>
        <Field label="Related deal"><Select name="deal_id"><option value="">— None —</option>{people(deals)}</Select></Field>
        <Field label="Client name"><Input name="client_name" /></Field>
        <Field label="Method"><Select name="method" defaultValue="bank_transfer">{opts(PAYMENT_METHODS)}</Select></Field>
        <Field label="Status"><Select name="status" defaultValue="successful">{opts(PAYMENT_STATUSES)}</Select></Field>
        <Field label="Date received"><Input name="received_at" type="date" required /></Field>
        <Field label="Reference"><Input name="reference" placeholder="transfer ref / receipt no." /></Field>
        <div className="sm:col-span-2"><Field label="Notes"><Textarea name="notes" /></Field></div>
      </div>
    </CollapsibleForm>
  );
}

export function ExpenseForm({ action }: { action: (fd: FormData) => Promise<{ ok: boolean; message: string }> }) {
  return (
    <CollapsibleForm title="Record expense" action={action}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Title *"><Input name="title" required /></Field>
        <Field label="Category"><Input name="category" defaultValue="general" placeholder="software, transport, salary…" /></Field>
        <Field label="Amount (₦) *"><Input name="amount" type="number" min="0.01" step="0.01" required /></Field>
        <Field label="Date"><Input name="spent_at" type="date" required /></Field>
        <Field label="Method"><Select name="method" defaultValue="bank_transfer">{opts(PAYMENT_METHODS)}</Select></Field>
        <Field label="Reference"><Input name="reference" /></Field>
        <div className="sm:col-span-2 lg:col-span-3"><Field label="Notes"><Textarea name="notes" /></Field></div>
      </div>
    </CollapsibleForm>
  );
}

export function RejectionForm({ action, prospects, deals }: { action: (fd: FormData) => Promise<{ ok: boolean; message: string }>; prospects: Opt[]; deals: Opt[] }) {
  return (
    <CollapsibleForm title="Record rejection / lost opportunity" action={action}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Prospect *"><Select name="prospect_id" required><option value="">— Select —</option>{people(prospects)}</Select></Field>
        <Field label="Related deal (optional)"><Select name="deal_id"><option value="">— None —</option>{people(deals)}</Select></Field>
        <Field label="Reason"><Select name="reason" defaultValue="not_interested">{opts(REJECTION_REASONS)}</Select></Field>
        <Field label="Competitor"><Input name="competitor" /></Field>
        <Field label="Date"><Input name="rejected_at" type="date" required /></Field>
        <div className="sm:col-span-2 lg:col-span-3"><Field label="Notes"><Textarea name="notes" /></Field></div>
      </div>
    </CollapsibleForm>
  );
}

export function TaskForm({ action, staff, prospects }: { action: (fd: FormData) => Promise<{ ok: boolean; message: string }>; staff: Opt[]; prospects: Opt[] }) {
  return (
    <CollapsibleForm title="Create task" action={action}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Title *"><Input name="title" required /></Field>
        <Field label="Assign to"><Select name="assigned_to"><option value="">— Me —</option>{people(staff)}</Select></Field>
        <Field label="Due date"><Input name="due_date" type="date" /></Field>
        <Field label="Priority"><Select name="priority" defaultValue="medium">{opts(TASK_PRIORITIES)}</Select></Field>
        <Field label="Related prospect"><Select name="prospect_id"><option value="">— None —</option>{people(prospects)}</Select></Field>
        <div className="sm:col-span-2 lg:col-span-3"><Field label="Description"><Textarea name="description" /></Field></div>
      </div>
    </CollapsibleForm>
  );
}

export function InviteStaffForm({ action }: { action: (fd: FormData) => Promise<{ ok: boolean; message: string }> }) {
  return (
    <CollapsibleForm title="Invite staff member" action={action}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Email *"><Input name="email" type="email" required /></Field>
        <Field label="Full name"><Input name="full_name" /></Field>
        <Field label="Role"><Select name="role" defaultValue="staff">{opts(['admin', 'staff'])}</Select></Field>
      </div>
    </CollapsibleForm>
  );
}
