-- Store direct contact destinations and an optional per-prospect outreach message.
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS whatsapp_link text,
  ADD COLUMN IF NOT EXISTS email_link text,
  ADD COLUMN IF NOT EXISTS telegram_link text,
  ADD COLUMN IF NOT EXISTS prefilled_message text;
