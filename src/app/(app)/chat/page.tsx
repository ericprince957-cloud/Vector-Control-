import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { ErrorState } from '@/components/ui';
import { ChatRoom, type ChatMessage } from '@/components/chat-room';

export const metadata: Metadata = { title: 'Team chat', description: 'Group chat for the whole team.' };
export const dynamic = 'force-dynamic';

export default async function ChatPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, sender_id, sender_name, sender_role, body, created_at')
    .order('created_at', { ascending: false })
    .limit(150);
  const initial = ((data ?? []) as ChatMessage[]).reverse();

  return (
    <>
      <PageHeader title="Team chat" description="One group chat for everyone on the team. Messages appear instantly for everybody." />
      {error ? <ErrorState title="Could not load the chat" message={error.message} /> : null}
      <ChatRoom initial={initial} me={{ id: profile.id }} canModerate={profile.role === 'founder'} />
    </>
  );
}
