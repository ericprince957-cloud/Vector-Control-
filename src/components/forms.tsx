'use client';

import { FormDialog } from './form-dialog';
import { Field, Input, Select, Textarea } from './ui';
import {
  PROSPECT_STATUSES, OUTREACH_CHANNELS, OUTREACH_DIRECTIONS, OUTREACH_OUTCOMES,
  DEAL_STATUSES, PROJECT_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES,
  TRANSACTION_TYPES, REJECTION_CATEGORIES, TASK_PRIORITIES, TASK_STATUSES, label
} from '@/lib/constants';
import type { ActionState } from '@/lib/validators';
import type { Opt } from '@/lib/ui-helpers';

type Action = (fd: FormData) => Promise<ActionState>;

const opts = (list: readonly string[]) => list.map((v) => <option key={v} value={v}>{label(v)}</option>);
const people = (list: Opt[]) => list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>);
const day = (v: string | null | undefined) => (v ? v.slice(0, 10) : '');
const dateTimeLocal = (v: string | null | undefined) => (v ? new Date(v).toISOString().slice(0, 16) : '');
const today = () => new Date().toISOString().slice(0, 10);

const grid = 'grid gap-4 sm:grid-cols-2';

/*
 * LIVE-SCHEMA NOTE
 * The live database CHECK constraints differ from the app's zod enums for two
 * values: projects.status uses 'review' (app: 'under_review') and
 * rejections.category uses 'project_postponed' (app: 'postponed'). Choosing
 * either would always fail, so they are not offered here. See delivery notes.
 */
const SAFE_PROJECT_STATUSES = PROJECT_STATUSES.filter((s) => s !== 'under_review');
/** Status choices that match the live database ('review' is stored; shown as “Under review”). */
const PROJECT_STATUS_CHOICES = [...SAFE_PROJECT_STATUSES.slice(0, 2), 'review', ...SAFE_PROJECT_STATUSES.slice(2)];
const SAFE_REJECTION_CATEGORIES = REJECTION_CATEGORIES.filter((c) => c !== 'postponed');

/* ───────────────────────────── Prospects ───────────────────────────── */

type ProspectRow = {
  id: string; company_name: string; contact_name: string | null; industry: string | null; phone: string | null;
  email: string | null; whatsapp_link?: string | null; email_link?: string | null; telegram_link?: string | null; prefilled_message?: string | null; website_url: string | null; location: string | null; source: string | null;
  estimated_value: number | string; status: string; notes: string | null; next_follow_up_at: string | null; assigned_to: string | null;
};

export function ProspectDialog({ action, staff, prospect, canAssign = true }: { action: Action; staff: Opt[]; prospect?: ProspectRow; canAssign?: boolean }) {
  const edit = Boolean(prospect);
  return (
    <FormDialog
      title={edit ? 'Edit prospect' : 'Add prospect'}
      description={edit ? prospect?.company_name : 'Record a new business in the CRM.'}
      triggerLabel={edit ? 'Edit' : 'Add prospect'}
      triggerVariant={edit ? 'ghost' : 'primary'}
      icon={edit ? 'edit' : 'plus'}
      action={action}
      submitLabel={edit ? 'Save changes' : 'Add prospect'}
    >
      {prospect ? <input type="hidden" name="id" value={prospect.id} /> : null}
      <input type="hidden" name="currency" value="NGN" />
      <div className={grid}>
        <Field label="Company name *"><Input name="company_name" required defaultValue={prospect?.company_name} /></Field>
        <Field label="Contact person"><Input name="contact_name" defaultValue={prospect?.contact_name ?? ''} /></Field>
        <Field label="Industry"><Input name="industry" defaultValue={prospect?.industry ?? ''} /></Field>
        <Field label="Source"><Input name="source" defaultValue={prospect?.source ?? ''} placeholder="referral, whatsapp, x, cold outreach…" /></Field>
        <Field label="Phone"><Input name="phone" type="tel" defaultValue={prospect?.phone ?? ''} /></Field>
        <Field label="Email"><Input name="email" type="email" defaultValue={prospect?.email ?? ''} /></Field>
        <Field label="WhatsApp Link"><Input name="whatsapp_link" defaultValue={prospect?.whatsapp_link ?? ''} placeholder="https://wa.me/234..." /></Field>
        <Field label="Email Link"><Input name="email_link" defaultValue={prospect?.email_link ?? ''} placeholder="mailto:contact@example.com" /></Field>
        <Field label="Telegram Link"><Input name="telegram_link" defaultValue={prospect?.telegram_link ?? ''} placeholder="https://t.me/username" /></Field>
        <Field label="Prefilled Message" className="sm:col-span-2"><Textarea name="prefilled_message" defaultValue={prospect?.prefilled_message ?? ''} placeholder="Hi {contact_name}, I came across {company_name}..." /></Field>
        <Field label="Website"><Input name="website_url" defaultValue={prospect?.website_url ?? ''} /></Field>
        <Field label="Location"><Input name="location" defaultValue={prospect?.location ?? ''} /></Field>
        <Field label="Agreed / estimated value (₦)"><Input name="estimated_value" type="number" min="0" step="0.01" defaultValue={prospect ? String(prospect.estimated_value) : '0'} /></Field>
        {!edit && canAssign ? <>
          <Field label="Amount already paid (₦)" hint="Optional. Recorded as a successful payment in the ledger."><Input name="amount_paid" type="number" min="0" step="0.01" defaultValue="0" /></Field>
          <Field label="Payment method"><Select name="initial_payment_method" defaultValue="bank_transfer">{opts(PAYMENT_METHODS)}</Select></Field>
          <Field label="Date received"><Input name="initial_paid_at" type="date" defaultValue={today()} /></Field>
        </> : null}
        <Field label="Status"><Select name="status" defaultValue={prospect?.status ?? 'new'}>{opts(PROSPECT_STATUSES)}</Select></Field>
        {canAssign ? (
          <Field label="Assigned to"><Select name="assigned_to" defaultValue={prospect?.assigned_to ?? ''}><option value="">Unassigned</option>{people(staff)}</Select></Field>
        ) : null}
        <Field label="Next follow-up"><Input name="next_follow_up_at" type="date" defaultValue={day(prospect?.next_follow_up_at)} /></Field>
        <Field label="Notes" className="sm:col-span-2"><Textarea name="notes" defaultValue={prospect?.notes ?? ''} /></Field>
      </div>
    </FormDialog>
  );
}

/* ───────────────────────────── Outreach ───────────────────────────── */

export function OutreachDialog({ action, prospects, defaultProspectId }: { action: Action; prospects: Opt[]; defaultProspectId?: string }) {
  return (
    <FormDialog title="Record outreach" description="Log who you contacted, how, and what happened." triggerLabel="Record outreach" action={action} submitLabel="Record outreach">
      <div className={grid}>
        <Field label="Prospect *">
          <Select name="prospect_id" required defaultValue={defaultProspectId ?? ''}><option value="">Select a prospect</option>{people(prospects)}</Select>
        </Field>
        <Field label="Channel"><Select name="channel" defaultValue="whatsapp">{opts(OUTREACH_CHANNELS)}</Select></Field>
        <Field label="Direction"><Select name="direction" defaultValue="outbound">{opts(OUTREACH_DIRECTIONS)}</Select></Field>
        <Field label="Date & time"><Input name="contacted_at" type="datetime-local" /></Field>
        <Field label="Outcome / response"><Select name="outcome" defaultValue="no_response">{opts(OUTREACH_OUTCOMES)}</Select></Field>
        <Field label="Next follow-up"><Input name="next_follow_up_at" type="date" /></Field>
        <Field label="Subject" className="sm:col-span-2"><Input name="subject" /></Field>
        <Field label="What was said / how they responded" className="sm:col-span-2"><Textarea name="message_summary" /></Field>
      </div>
    </FormDialog>
  );
}

/* ───────────────────────────── Deals ───────────────────────────── */

type DealRow = { id: string; title: string; prospect_id: string | null; description: string | null; deal_value: number | string; expected_close_date: string | null; assigned_to: string | null; status: string };

export function DealDialog({ action, prospects, staff, isFounder, deal }: { action: Action; prospects: Opt[]; staff: Opt[]; isFounder: boolean; deal?: DealRow }) {
  const edit = Boolean(deal);
  return (
    <FormDialog
      title={edit ? 'Edit deal' : 'Create deal'}
      description={isFounder ? undefined : 'Draft deals and proposed values need founder approval before they are final.'}
      triggerLabel={edit ? 'Edit' : 'Create deal'}
      triggerVariant={edit ? 'ghost' : 'primary'}
      icon={edit ? 'edit' : 'plus'}
      action={action}
      submitLabel={edit ? 'Save changes' : 'Create deal'}
    >
      {deal ? <input type="hidden" name="id" value={deal.id} /> : null}
      <input type="hidden" name="currency" value="NGN" />
      {/* Staff cannot choose a stage: the current stage (or draft) is sent unchanged. */}
      {!isFounder ? <input type="hidden" name="status" value={deal?.status ?? 'draft'} /> : null}
      <div className={grid}>
        <Field label="Deal title *"><Input name="title" required defaultValue={deal?.title} /></Field>
        <Field label="Prospect *">
          <Select name="prospect_id" required defaultValue={deal?.prospect_id ?? ''}><option value="">Select a prospect</option>{people(prospects)}</Select>
        </Field>
        <Field label={isFounder ? 'Deal value (₦)' : 'Proposed value (₦)'} hint={isFounder ? undefined : 'Final pricing is approved by the founder.'}>
          <Input name="deal_value" type="number" min="0" step="0.01" defaultValue={deal ? String(deal.deal_value) : '0'} />
        </Field>
        {isFounder && !edit ? <>
          <Field label="Total amount paid so far (₦)" hint="Enter the total received to date. Payments already recorded on this prospect are linked automatically and will not be counted twice."><Input name="amount_paid" type="number" min="0" step="0.01" defaultValue="0" /></Field>
          <Field label="Payment method"><Select name="initial_payment_method" defaultValue="bank_transfer">{opts(PAYMENT_METHODS)}</Select></Field>
          <Field label="Date received"><Input name="initial_paid_at" type="date" defaultValue={today()} /></Field>
        </> : null}
        <Field label="Expected close date"><Input name="expected_close_date" type="date" defaultValue={day(deal?.expected_close_date)} /></Field>
        {isFounder ? (
          <>
            <Field label="Responsible staff"><Select name="assigned_to" defaultValue={deal?.assigned_to ?? ''}><option value="">Unassigned</option>{people(staff)}</Select></Field>
            <Field label="Stage"><Select name="status" defaultValue={deal?.status ?? 'draft'}>{opts(DEAL_STATUSES)}</Select></Field>
          </>
        ) : null}
        <Field label="Description / negotiation notes" className="sm:col-span-2"><Textarea name="description" defaultValue={deal?.description ?? ''} /></Field>
      </div>
    </FormDialog>
  );
}

/* ───────────────────────────── Projects ───────────────────────────── */

type ProjectRow = { id: string; project_name: string; client_name: string | null; deal_id: string | null; description: string | null; contract_value: number | string; start_date: string | null; due_date: string | null; assigned_to: string | null; status: string };

export function ProjectDialog({ action, deals, staff, project, isFounder = true }: { action: Action; deals: Opt[]; staff: Opt[]; project?: ProjectRow; isFounder?: boolean }) {
  const edit = Boolean(project);
  const dealChoices = project?.deal_id && !deals.some((d) => d.id === project.deal_id) ? [...deals, { id: project.deal_id, name: 'Linked deal' }] : deals;
  return (
    <FormDialog
      title={edit ? 'Edit project' : 'Create project'}
      description={isFounder ? 'Update details, status, dates or the team any time.' : 'You can update details, dates, team and status. Contract value and closing or cancelling a project are founder-only.'}
      triggerLabel={edit ? 'Edit' : 'Create project'}
      triggerVariant={edit ? 'ghost' : 'primary'}
      icon={edit ? 'edit' : 'plus'}
      action={action}
      submitLabel={edit ? 'Save changes' : 'Create project'}
    >
      {project ? <input type="hidden" name="id" value={project.id} /> : null}
      <input type="hidden" name="currency" value="NGN" />
      <div className={grid}>
        <Field label="Project name *"><Input name="project_name" required defaultValue={project?.project_name} /></Field>
        <Field label="Client"><Input name="client_name" defaultValue={project?.client_name ?? ''} /></Field>
        <Field label="Related won deal"><Select name="deal_id" defaultValue={project?.deal_id ?? ''}><option value="">None</option>{people(dealChoices)}</Select></Field>
        <Field label="Contract value (₦)" hint={isFounder ? undefined : 'Only the founder can change this.'}><Input name="contract_value" type="number" min="0" step="0.01" readOnly={!isFounder} defaultValue={project ? String(project.contract_value) : '0'} /></Field>
        <Field label="Start date"><Input name="start_date" type="date" defaultValue={day(project?.start_date)} /></Field>
        <Field label="Due date"><Input name="due_date" type="date" defaultValue={day(project?.due_date)} /></Field>
        <Field label="Assigned to"><Select name="assigned_to" defaultValue={project?.assigned_to ?? ''}><option value="">Unassigned</option>{people(staff)}</Select></Field>
        <Field label="Status"><Select name="status" defaultValue={project?.status ?? 'not_started'}>{PROJECT_STATUS_CHOICES.map((st) => <option key={st} value={st}>{st === 'review' ? 'Under review' : label(st)}</option>)}</Select></Field>
        <Field label="Description" className="sm:col-span-2"><Textarea name="description" defaultValue={project?.description ?? ''} /></Field>
      </div>
    </FormDialog>
  );
}

/* ───────────────────────────── Finance ───────────────────────────── */

type PaymentRow = {
  id: string; amount: number | string; transaction_type: string; status: string; payment_method: string;
  deal_id: string | null; project_id: string | null; client_name: string | null; paid_at: string | null;
  payment_reference: string | null; notes: string | null;
};

export function PaymentDialog({ action, deals, projects, payment }: { action: Action; deals: Opt[]; projects: Opt[]; payment?: PaymentRow }) {
  const edit = Boolean(payment);
  return (
    <FormDialog
      title={edit ? 'Edit payment' : 'Record payment or refund'}
      description="Only payments with status “successful” count as received revenue. Pending and failed payments never do."
      triggerLabel={edit ? 'Edit' : 'Record payment'}
      triggerVariant={edit ? 'subtle' : 'primary'}
      triggerSize={edit ? 'sm' : 'md'}
      icon={edit ? 'edit' : 'plus'}
      action={action}
      submitLabel={edit ? 'Save changes' : 'Record'}
    >
      {payment ? <input type="hidden" name="id" value={payment.id} /> : null}
      <input type="hidden" name="currency" value="NGN" />
      <div className={grid}>
        <Field label="Amount (₦) *"><Input name="amount" type="number" min="0.01" step="0.01" required defaultValue={payment ? String(payment.amount) : undefined} /></Field>
        <Field label="Transaction type"><Select name="transaction_type" defaultValue={payment?.transaction_type ?? 'payment'}>{opts(TRANSACTION_TYPES)}</Select></Field>
        <Field label="Status"><Select name="status" defaultValue={payment?.status ?? 'successful'}>{opts(PAYMENT_STATUSES)}</Select></Field>
        <Field label="Payment method"><Select name="payment_method" defaultValue={payment?.payment_method ?? 'bank_transfer'}>{opts(PAYMENT_METHODS)}</Select></Field>
        <Field label="Related deal"><Select name="deal_id" defaultValue={payment?.deal_id ?? ''}><option value="">None</option>{people(deals)}</Select></Field>
        <Field label="Related project"><Select name="project_id" defaultValue={payment?.project_id ?? ''}><option value="">None</option>{people(projects)}</Select></Field>
        <Field label="Client name"><Input name="client_name" defaultValue={payment?.client_name ?? ''} /></Field>
        <Field label="Date paid *"><Input name="paid_at" type="date" required defaultValue={payment?.paid_at ? day(payment.paid_at) : today()} /></Field>
        <Field label="Reference" className="sm:col-span-2"><Input name="payment_reference" defaultValue={payment?.payment_reference ?? ''} placeholder="Transfer reference / receipt number" /></Field>
        <Field label="Notes" className="sm:col-span-2"><Textarea name="notes" defaultValue={payment?.notes ?? ''} /></Field>
      </div>
    </FormDialog>
  );
}

type ExpenseRow = { id: string; title: string; category: string | null; amount: number | string; expense_date: string; vendor: string | null; reference: string | null; notes: string | null };

export function ExpenseDialog({ action, categories, expense }: { action: Action; categories: string[]; expense?: ExpenseRow }) {
  const edit = Boolean(expense);
  const listId = 'expense-categories';
  return (
    <FormDialog
      title={edit ? 'Edit expense' : 'Record expense'}
      triggerLabel={edit ? 'Edit' : 'Record expense'}
      triggerVariant={edit ? 'ghost' : 'primary'}
      triggerSize={edit ? 'sm' : 'md'}
      icon={edit ? 'edit' : 'plus'}
      action={action}
      submitLabel={edit ? 'Save changes' : 'Record expense'}
    >
      {expense ? <input type="hidden" name="id" value={expense.id} /> : null}
      <input type="hidden" name="currency" value="NGN" />
      <div className={grid}>
        <Field label="Title *"><Input name="title" required defaultValue={expense?.title} /></Field>
        <Field label="Category">
          <Input name="category" list={listId} defaultValue={expense?.category ?? 'general'} placeholder="software, transport, salary…" />
        </Field>
        <datalist id={listId}>{categories.map((c) => <option key={c} value={c} />)}</datalist>
        <Field label="Amount (₦) *"><Input name="amount" type="number" min="0.01" step="0.01" required defaultValue={expense ? String(expense.amount) : undefined} /></Field>
        <Field label="Date paid *"><Input name="expense_date" type="date" required defaultValue={expense?.expense_date ?? today()} /></Field>
        <Field label="Vendor"><Input name="vendor" defaultValue={expense?.vendor ?? ''} /></Field>
        <Field label="Reference"><Input name="reference" defaultValue={expense?.reference ?? ''} /></Field>
        <Field label="Notes" className="sm:col-span-2"><Textarea name="notes" defaultValue={expense?.notes ?? ''} /></Field>
      </div>
    </FormDialog>
  );
}

/* ───────────────────────────── Rejections ───────────────────────────── */

export function RejectionDialog({ action, prospects, deals }: { action: Action; prospects: Opt[]; deals: Opt[] }) {
  return (
    <FormDialog
      title="Record rejection"
      description="Linking a prospect marks it disqualified. History is never deleted."
      triggerLabel="Record rejection"
      action={action}
      submitLabel="Record rejection"
    >
      <input type="hidden" name="currency" value="NGN" />
      <div className={grid}>
        <Field label="Existing prospect"><Select name="prospect_id" defaultValue=""><option value="">New company (enter below)</option>{people(prospects)}</Select></Field>
        <Field label="Company name (if no prospect)"><Input name="company_name" /></Field>
        <Field label="Contact name"><Input name="contact_name" /></Field>
        <Field label="Related deal"><Select name="deal_id" defaultValue=""><option value="">None</option>{people(deals)}</Select></Field>
        <Field label="Reason category"><Select name="category" defaultValue="not_interested">{opts(SAFE_REJECTION_CATEGORIES)}</Select></Field>
        <Field label="Potential value (₦)"><Input name="potential_value" type="number" min="0" step="0.01" defaultValue="0" /></Field>
        <Field label="Date *"><Input name="rejected_at" type="date" required defaultValue={today()} /></Field>
        <Field label="Follow-up possible"><Select name="follow_up_possible" defaultValue="true"><option value="true">Yes</option><option value="false">No</option></Select></Field>
        <Field label="Follow-up date"><Input name="follow_up_at" type="date" /></Field>
        <Field label="Reason / notes" className="sm:col-span-2"><Textarea name="reason" /></Field>
      </div>
    </FormDialog>
  );
}

/* ───────────────────────────── Tasks ───────────────────────────── */

type TaskRow = { id: string; title: string; description: string | null; status: string; priority: string; due_at: string | null; assigned_to: string | null; prospect_id: string | null; project_id: string | null; deal_id: string | null };

export function TaskDialog({ action, staff, prospects, projects, task, defaultProspectId, defaultProjectId }: {
  action: Action; staff: Opt[]; prospects: Opt[]; projects: Opt[]; task?: TaskRow; defaultProspectId?: string; defaultProjectId?: string;
}) {
  const edit = Boolean(task);
  return (
    <FormDialog
      title={edit ? 'Edit task' : 'Create task'}
      triggerLabel={edit ? 'Edit' : 'Create task'}
      triggerVariant={edit ? 'subtle' : 'primary'}
      triggerSize={edit ? 'sm' : 'md'}
      icon={edit ? 'edit' : 'plus'}
      action={action}
      submitLabel={edit ? 'Save changes' : 'Create task'}
    >
      {task ? <input type="hidden" name="id" value={task.id} /> : null}
      {task?.deal_id ? <input type="hidden" name="deal_id" value={task.deal_id} /> : null}
      <div className={grid}>
        <Field label="Title *" className="sm:col-span-2"><Input name="title" required defaultValue={task?.title} /></Field>
        <Field label="Assign to"><Select name="assigned_to" defaultValue={task?.assigned_to ?? ''}><option value="">Me</option>{people(staff)}</Select></Field>
        <Field label="Due (date & time)"><Input name="due_at" type="datetime-local" defaultValue={dateTimeLocal(task?.due_at)} /></Field>
        <Field label="Priority"><Select name="priority" defaultValue={task?.priority ?? 'medium'}>{opts(TASK_PRIORITIES)}</Select></Field>
        <Field label="Status"><Select name="status" defaultValue={task?.status ?? 'todo'}>{opts(TASK_STATUSES)}</Select></Field>
        <Field label="Related prospect"><Select name="prospect_id" defaultValue={task?.prospect_id ?? defaultProspectId ?? ''}><option value="">None</option>{people(prospects)}</Select></Field>
        <Field label="Related project"><Select name="project_id" defaultValue={task?.project_id ?? defaultProjectId ?? ''}><option value="">None</option>{people(projects)}</Select></Field>
        <Field label="Description" className="sm:col-span-2"><Textarea name="description" defaultValue={task?.description ?? ''} /></Field>
      </div>
    </FormDialog>
  );
}

/* ───────────────────────────── Staff ───────────────────────────── */

export function InviteStaffDialog({ action }: { action: Action }) {
  return (
    <FormDialog
      title="Invite staff member"
      description="They get an invitation email and can sign in with the temporary password 1234567; a banner tells them to change it immediately. Their account stays inactive until you activate it."
      triggerLabel="Invite staff"
      action={action}
      submitLabel="Send invitation"
      size="sm"
    >
      <div className="space-y-4">
        <Field label="Email *"><Input name="email" type="email" required autoComplete="off" /></Field>
        <Field label="Full name"><Input name="full_name" /></Field>
        <Field label="Role"><Select name="role" defaultValue="staff"><option value="staff">Staff</option><option value="admin">Admin</option></Select></Field>
      </div>
    </FormDialog>
  );
}
