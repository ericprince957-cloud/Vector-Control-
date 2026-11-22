'use client';

import { useTransition } from 'react';
import { MessageCircle, Mail, Send, Phone } from 'lucide-react';
import { useToast } from './toast';
import { cn } from '@/lib/utils';
import type { ContactLinks } from '@/lib/contact';
import type { ActionState } from '@/lib/validators';

const pill = 'inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors';

/**
 * Pill buttons that open a chat/email/call with the message pre-filled.
 * Clicking a chat button also moves a "new" prospect to "contacted" so you can
 * track who you have and have not messaged. Other statuses are never changed.
 */
export function ContactPills({ prospectId, status, links, action, className }: {
  prospectId: string;
  status: string;
  links: ContactLinks;
  action: (fd: FormData) => Promise<ActionState>;
  className?: string;
}) {
  const [, start] = useTransition();
  const { notify } = useToast();

  function markContacted() {
    if (status !== 'new') return;
    const fd = new FormData();
    fd.set('id', prospectId);
    fd.set('status', 'contacted');
    fd.set('only_if_new', '1');
    start(async () => {
      try {
        const res = await action(fd);
        if (!res.ok) notify(false, res.message);
        else if (res.message.startsWith('Marked')) notify(true, res.message);
      } catch {
        notify(false, 'Could not update the status. Check your connection.');
      }
    });
  }

  if (!links.whatsapp && !links.email && !links.telegram && !links.call) {
    return <span className="text-xs text-muted">No contact details</span>;
  }
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {links.whatsapp ? (
        <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" onClick={markContacted} className={cn(pill, 'border-emerald-800 text-emerald-400 hover:bg-emerald-950/50')}>
          <MessageCircle size={13} aria-hidden /> WhatsApp
        </a>
      ) : null}
      {links.email ? (
        <a href={links.email} onClick={markContacted} className={cn(pill, 'border-sky-900 text-sky-400 hover:bg-sky-950/50')}>
          <Mail size={13} aria-hidden /> Email
        </a>
      ) : null}
      {links.telegram ? (
        <a href={links.telegram} target="_blank" rel="noopener noreferrer" onClick={markContacted} className={cn(pill, 'border-blue-900 text-blue-400 hover:bg-blue-950/50')}>
          <Send size={13} aria-hidden /> Telegram
        </a>
      ) : null}
      {links.call ? (
        <a href={links.call} onClick={markContacted} className={cn(pill, 'border-line-strong text-muted hover:border-gold/60 hover:text-gold')}>
          <Phone size={13} aria-hidden /> Call
        </a>
      ) : null}
    </div>
  );
}
