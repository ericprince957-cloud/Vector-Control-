import { z } from 'zod';

const optionalText = z.string().trim().max(2000).optional().or(z.literal(''));
const nullableDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal(''));
const money = z.coerce.number().min(0).max(1_000_000_000_000);

export const prospectSchema = z.object({
  company_name: z.string().trim().min(1, 'Company name is required').max(200),
  contact_name: optionalText,
  industry: optionalText,
  phone: optionalText,
  whatsapp: optionalText,
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  website: optionalText,
  location: optionalText,
  lead_source: optionalText,
  assigned_to: z.string().uuid().optional().nullable().or(z.literal('')),
  estimated_budget: money.default(0),
  notes: optionalText,
  status: z.enum(['new','contacted','responded','interested','qualified','converted','disqualified','on_hold']).default('new'),
  last_contact_at: nullableDate,
  next_follow_up_date: nullableDate
});

export const outreachSchema = z.object({
  prospect_id: z.string().uuid('Select a prospect'),
  channel: z.enum(['whatsapp','telegram','email','linkedin','phone','in_person','other']),
  direction: z.enum(['outbound','inbound']).default('outbound'),
  occurred_at: z.string().min(1),
  summary: optionalText,
  response: optionalText,
  outcome: z.enum(['no_response','interested','requested_info','meeting_scheduled','proposal_requested','not_interested','follow_up_required','referred']),
  staff_id: z.string().uuid().optional().nullable().or(z.literal('')),
  next_follow_up_date: nullableDate
});

export const dealSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  prospect_id: z.string().uuid('Select a prospect'),
  description: optionalText,
  service: optionalText,
  quoted_amount: money.default(0),
  negotiated_amount: money.optional().nullable(),
  expected_close_date: nullableDate,
  assigned_to: z.string().uuid().optional().nullable().or(z.literal('')),
  status: z.enum(['draft','proposal_sent','negotiation','won','lost','cancelled']).default('draft'),
  proposal_notes: optionalText,
  contract_notes: optionalText
});

export const projectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(200),
  client_name: optionalText,
  deal_id: z.string().uuid().optional().nullable().or(z.literal('')),
  description: optionalText,
  contract_amount: money.default(0),
  start_date: nullableDate,
  deadline: nullableDate,
  assigned_to: z.string().uuid().optional().nullable().or(z.literal('')),
  status: z.enum(['not_started','in_progress','under_review','completed','on_hold','cancelled']).default('not_started'),
  progress_notes: optionalText
});

export const paymentSchema = z.object({
  deal_id: z.string().uuid().optional().nullable().or(z.literal('')),
  client_name: optionalText,
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  method: z.enum(['bank_transfer','cash','card','pos','other']),
  status: z.enum(['pending','successful','failed','refunded']).default('pending'),
  reference: optionalText,
  received_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: optionalText
});

export const expenseSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  category: z.string().trim().min(1).max(100).default('general'),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  spent_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method: z.enum(['bank_transfer','cash','card','pos','other']),
  reference: optionalText,
  notes: optionalText
});

export const rejectionSchema = z.object({
  prospect_id: z.string().uuid('Select a prospect'),
  deal_id: z.string().uuid().optional().nullable().or(z.literal('')),
  reason: z.enum(['too_expensive','budget_unavailable','chose_competitor','no_response','not_interested','existing_developer','postponed','trust_concerns','timing','other']),
  competitor: optionalText,
  rejected_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: optionalText
});

export const taskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: optionalText,
  assigned_to: z.string().uuid().optional().nullable().or(z.literal('')),
  due_date: nullableDate,
  priority: z.enum(['low','medium','high','urgent']).default('medium'),
  prospect_id: z.string().uuid().optional().nullable().or(z.literal('')),
  deal_id: z.string().uuid().optional().nullable().or(z.literal(''))
});

export type ActionState = { ok: boolean; message: string };

export function parseOrError<T>(schema: z.ZodType<T>, formData: FormData): { data?: T; error?: string } {
  const raw = Object.fromEntries(formData.entries());
  const cleaned = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== ''));
  const result = schema.safeParse(cleaned);
  if (!result.success) {
    return { error: result.error.issues.map((i) => i.message).join('; ') };
  }
  return { data: result.data };
}
