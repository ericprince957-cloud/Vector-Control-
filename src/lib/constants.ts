export const PROSPECT_STATUSES = ['new','contacted','responded','interested','qualified','converted','disqualified','on_hold'] as const;
export const OUTREACH_CHANNELS = ['whatsapp','telegram','email','linkedin','phone','in_person','other'] as const;
export const OUTREACH_OUTCOMES = ['no_response','interested','requested_info','meeting_scheduled','proposal_requested','not_interested','follow_up_required','referred'] as const;
export const DEAL_STATUSES = ['draft','proposal_sent','negotiation','won','lost','cancelled'] as const;
export const PROJECT_STATUSES = ['not_started','in_progress','under_review','completed','on_hold','cancelled'] as const;
export const PAYMENT_METHODS = ['bank_transfer','cash','card','pos','other'] as const;
export const PAYMENT_STATUSES = ['pending','successful','failed','refunded'] as const;
export const REJECTION_REASONS = ['too_expensive','budget_unavailable','chose_competitor','no_response','not_interested','existing_developer','postponed','trust_concerns','timing','other'] as const;
export const TASK_PRIORITIES = ['low','medium','high','urgent'] as const;

export function label(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
