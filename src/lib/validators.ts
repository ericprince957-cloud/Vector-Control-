import { z } from 'zod';

const optionalText = z.string().trim().max(2000).optional().or(z.literal(''));
const nullableDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal(''));
const nullableDateTime = z.string().min(1).optional().nullable().or(z.literal(''));
const money = z.coerce.number().min(0).max(1_000_000_000_000);

export const prospectSchema = z.object({
  company_name: z.string().trim().min(1, 'Company name is required').max(200),
  contact_name: optionalText,
  industry: optionalText,
  phone: optionalText,
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  website_url: optionalText,
  location: optionalText,
  source: optionalText,
  estimated_value: money.default(0),
  amount_paid: money.default(0),
  currency: z.string().length(3).default('NGN'),
  notes: optionalText,
  status: z.enum(['new','contacted','responded','interested','qualified','converted','disqualified','on_hold']).default('new'),
  next_follow_up_at: nullableDate,
  assigned_to: z.string().uuid().optional().nullable().or(z.literal(''))
});

export const outreachSchema = z.object({
  prospect_id: z.string().uuid('Select a prospect'),
  channel: z.enum(['whatsapp','telegram','email','linkedin','phone','in_person','other']),
  direction: z.enum(['outbound','inbound']).default('outbound'),
  subject: optionalText,
  message_summary: optionalText,
  outcome: z.enum(['no_response','interested','requested_info','meeting_scheduled','proposal_requested','not_interested','follow_up_required','referred']),
  contacted_at: nullableDateTime,
  next_follow_up_at: nullableDate
});

export const dealSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  prospect_id: z.string().uuid('Select a prospect'),
  description: optionalText,
  deal_value: money.default(0),
  amount_paid: money.default(0),
  currency: z.string().length(3).default('NGN'),
  expected_close_date: nullableDate,
  assigned_to: z.string().uuid().optional().nullable().or(z.literal('')),
  status: z.enum(['draft','proposal_sent','negotiation','won','lost','cancelled']).default('draft')
});

export const projectSchema = z.object({
  project_name: z.string().trim().min(1, 'Project name is required').max(200),
  client_name: optionalText,
  deal_id: z.string().uuid().optional().nullable().or(z.literal('')),
  description: optionalText,
  contract_value: money.default(0),
  currency: z.string().length(3).default('NGN'),
  start_date: nullableDate,
  due_date: nullableDate,
  assigned_to: z.string().uuid().optional().nullable().or(z.literal('')),
  status: z.enum(['not_started','in_progress','under_review','completed','on_hold','cancelled']).default('not_started')
});

export const paymentSchema = z.object({
  deal_id: z.string().uuid().optional().nullable().or(z.literal('')),
  project_id: z.string().uuid().optional().nullable().or(z.literal('')),
  client_name: optionalText,
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  currency: z.string().length(3).default('NGN'),
  status: z.enum(['pending','successful','failed','refunded']).default('pending'),
  payment_method: z.enum(['bank_transfer','cash','card','pos','other']),
  payment_reference: optionalText,
  paid_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  transaction_type: z.enum(['payment','refund']).default('payment'),
  notes: optionalText
});

export const expenseSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  category: z.string().trim().min(1).max(100).default('general'),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  currency: z.string().length(3).default('NGN'),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vendor: optionalText,
  reference: optionalText,
  notes: optionalText
});

export const rejectionSchema = z.object({
  prospect_id: z.string().uuid('Select a prospect').optional().nullable().or(z.literal('')),
  deal_id: z.string().uuid().optional().nullable().or(z.literal('')),
  company_name: z.string().trim().min(1, 'Company name is required when no prospect is selected').max(200).optional().or(z.literal('')),
  contact_name: optionalText,
  category: z.enum(['too_expensive','budget_unavailable','chose_competitor','no_response','not_interested','existing_developer','postponed','trust_concerns','timing','other']),
  reason: optionalText,
  potential_value: money.default(0),
  currency: z.string().length(3).default('NGN'),
  rejected_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  follow_up_possible: z.enum(['true','false']).default('true'),
  follow_up_at: nullableDate,
  notes: optionalText
}).refine((d) => d.prospect_id || d.company_name, {
  message: 'Select an existing prospect or enter a company name',
  path: ['company_name']
});

export const taskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: optionalText,
  status: z.enum(['todo','in_progress','done','cancelled']).default('todo'),
  priority: z.enum(['low','medium','high','urgent']).default('medium'),
  due_at: nullableDateTime,
  assigned_to: z.string().uuid().optional().nullable().or(z.literal('')),
  prospect_id: z.string().uuid().optional().nullable().or(z.literal('')),
  deal_id: z.string().uuid().optional().nullable().or(z.literal('')),
  project_id: z.string().uuid().optional().nullable().or(z.literal(''))
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
