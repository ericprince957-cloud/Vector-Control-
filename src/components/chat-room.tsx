'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from './toast';
import { cn } from '@/lib/utils';

export type ChatMessage = { id: string; sender_id: string; sender_name: string; sender_role: string; body: string; created_at: string };

// Fixed timezone + locale so server and browser render identical text.
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hour12: false });
const dayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

function merge(list: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const map = new Map(list.map((m) => [m.id, m]));
  incoming.forEach((m) => map.set(m.id, m));
  return [...map.values()].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
}

/**
 * Group chat for the whole team. Messages arrive live (Supabase Realtime); if the live
 * connection drops, it falls back to checking for new messages every few seconds.
 */
export function ChatRoom({ initial, me, canModerate }: {
  initial: ChatMessage[];
  me: { id: string };
  canModerate: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [live, setLive] = useState(false);
  const { notify } = useToast();
  const supabase = useRef(createClient()).current;
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const latest = useRef(initial.at(-1)?.created_at ?? null);

  useEffect(() => { latest.current = messages.at(-1)?.created_at ?? latest.current; }, [messages]);

  const fetchNew = useCallback(async () => {
    let q = supabase.from('chat_messages').select('id, sender_id, sender_name, sender_role, body, created_at').order('created_at', { ascending: true }).limit(200);
    if (latest.current) q = q.gt('created_at', latest.current);
    const { data } = await q;
    if (data?.length) setMessages((m) => merge(m, data as ChatMessage[]));
  }, [supabase]);

  useEffect(() => {
    const channel = supabase
      .channel('team-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        setMessages((m) => merge(m, [payload.new as ChatMessage]));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (payload) => {
        const id = (payload.old as { id?: string }).id;
        if (id) setMessages((m) => m.filter((x) => x.id !== id));
      })
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') void fetchNew();
      });
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, fetchNew]);

  // Fallback while the live connection is down.
  useEffect(() => {
    if (live) return;
    const t = setInterval(() => { void fetchNew(); }, 6000);
    return () => clearInterval(t);
  }, [live, fetchNew]);

  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const { data, error } = await supabase.from('chat_messages').insert({ body, sender_id: me.id }).select('id, sender_id, sender_name, sender_role, body, created_at').single();
    setSending(false);
    if (error || !data) {
      notify(false, 'Message not sent. Check your connection and try again.');
      return;
    }
    setText('');
    stick.current = true;
    setMessages((m) => merge(m, [data as ChatMessage]));
  }

  async function remove(id: string) {
    const before = messages;
    setMessages((m) => m.filter((x) => x.id !== id));
    const { error } = await supabase.from('chat_messages').delete().eq('id', id);
    if (error) { setMessages(before); notify(false, 'Could not delete that message.'); }
  }

  let lastDay = '';
  return (
    <div className="flex h-[calc(100dvh-13rem)] min-h-[420px] flex-col overflow-hidden rounded-[6px] border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <p className="text-sm font-semibold">Team chat <span className="font-normal text-muted">· everyone on the team</span></p>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted" role="status">
          <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', live ? 'bg-success' : 'bg-warn')} />
          {live ? 'Live' : 'Reconnecting…'}
        </span>
      </div>

      <div
        ref={scroller}
        onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}
        className="vc-scroll flex-1 space-y-1 overflow-y-auto px-4 py-4"
        aria-live="polite"
      >
        {!messages.length ? <p className="py-16 text-center text-sm text-muted">No messages yet. Say hello to the team.</p> : null}
        {messages.map((m) => {
          const day = dayFmt.format(new Date(m.created_at));
          const header = day !== lastDay;
          lastDay = day;
          const mine = m.sender_id === me.id;
          return (
            <div key={m.id}>
              {header ? <p className="my-3 text-center text-[11px] uppercase tracking-wider text-muted">{day}</p> : null}
              <div className={cn('group flex', mine ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[85%] rounded-[8px] border px-3 py-2 sm:max-w-[70%]', mine ? 'border-gold/40 bg-gold/10' : 'border-line bg-surface-2')}>
                  {!mine ? (
                    <p className="mb-0.5 text-[11px] font-semibold text-gold">
                      {m.sender_name || 'Team member'}
                      {m.sender_role !== 'staff' ? <span className="ml-1.5 font-normal capitalize text-muted">{m.sender_role}</span> : null}
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                  <p className="mt-1 flex items-center justify-end gap-2 text-[10px] text-muted">
                    {mine || canModerate ? (
                      <button type="button" onClick={() => remove(m.id)} aria-label="Delete message" className="opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100">
                        <Trash2 size={11} />
                      </button>
                    ) : null}
                    {timeFmt.format(new Date(m.created_at))}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void send(); }}
        className="flex items-end gap-2 border-t border-line p-3"
      >
        <label htmlFor="chat-input" className="sr-only">Message the team</label>
        <textarea
          id="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
          rows={1}
          maxLength={2000}
          placeholder="Message the team… (Enter to send, Shift+Enter for a new line)"
          className="max-h-32 min-h-10 flex-1 resize-none rounded-[5px] border border-line-strong bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-muted/60 focus:border-gold/70 focus:outline-none"
        />
        <button type="submit" disabled={sending || !text.trim()} aria-label="Send message" className="inline-flex min-h-10 items-center gap-2 rounded-[5px] bg-gold px-4 text-sm font-semibold text-black hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-50">
          <Send size={15} aria-hidden /> <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  );
}
