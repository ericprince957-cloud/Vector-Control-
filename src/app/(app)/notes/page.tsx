import type { Metadata } from 'next';
import { Pin, PinOff, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { Card, Badge, Button, EmptyState, ErrorState, Tabs } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { ActionForm } from '@/components/action-form';
import { NoteDialog } from '@/components/note-dialog';
import { FilterBar } from '@/components/filter-bar';
import { saveNote, toggleNotePin, deleteNote } from '@/actions/notes';
import { safeSearch } from '@/lib/ui-helpers';

export const metadata: Metadata = { title: 'Notes', description: 'Your notes and things not to forget.' };
export const dynamic = 'force-dynamic';

type SP = { tab?: string; q?: string };

const stamp = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));

export default async function NotesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const profile = await requireProfile();
  const sp = await searchParams;
  const tab = sp.tab === 'team' ? 'team' : sp.tab === 'pinned' ? 'pinned' : 'mine';
  const q = safeSearch(sp.q);
  const supabase = await createClient();

  let query = supabase.from('notes').select('*').order('pinned', { ascending: false }).order('updated_at', { ascending: false }).limit(200);
  if (tab === 'team') query = query.eq('shared', true).neq('owner_id', profile.id);
  else if (tab === 'pinned') query = query.eq('owner_id', profile.id).eq('pinned', true);
  else query = query.eq('owner_id', profile.id);
  if (q) query = query.or(`title.ilike.%${q}%,body.ilike.%${q}%`);

  const { data, error } = await query;
  const notes = data ?? [];
  const isFounder = profile.role === 'founder';
  const href = (t: string) => (t === 'mine' ? '/notes' : `/notes?tab=${t}`);

  return (
    <>
      <PageHeader title="Notes" description="Write down anything you don’t want to forget. Notes are private unless you share them with the team.">
        <NoteDialog action={saveNote} />
      </PageHeader>

      <Tabs
        active={tab}
        tabs={[
          { key: 'mine', label: 'My notes', href: href('mine') },
          { key: 'pinned', label: 'Pinned', href: href('pinned') },
          { key: 'team', label: 'Shared by team', href: href('team') }
        ]}
      />

      <FilterBar basePath="/notes" values={{ q: sp.q }} hidden={{ tab: sp.tab }} filters={[{ kind: 'search', name: 'q', placeholder: 'Search notes…' }]} />
      {error ? <ErrorState title="Could not load notes" message={error.message} /> : null}

      {!notes.length && !error ? (
        <Card>
          <EmptyState
            title={q ? 'No notes match your search' : tab === 'team' ? 'Nothing shared by the team yet' : tab === 'pinned' ? 'No pinned notes' : 'No notes yet'}
            hint={tab === 'mine' && !q ? 'Use “New note” to write your first one.' : undefined}
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {notes.map((n) => {
            const mine = n.owner_id === profile.id;
            return (
              <Card key={n.id} className={`flex flex-col ${n.pinned ? 'border-gold/40' : ''}`}>
                <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
                  <h2 className="min-w-0 break-words text-sm font-semibold">{n.title || 'Untitled note'}</h2>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {n.pinned ? <Pin size={13} className="text-gold" aria-label="Pinned" /> : null}
                    {n.shared ? <Badge tone="blue">Shared</Badge> : null}
                  </div>
                </div>
                <p className="flex-1 whitespace-pre-wrap break-words px-4 py-3 text-sm text-muted [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:8] overflow-hidden">{n.body || '—'}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5">
                  <p className="text-[11px] text-muted">
                    {mine ? null : <><Users size={11} className="mr-1 inline" aria-hidden />{n.owner_name} · </>}
                    Edited {stamp(n.updated_at)}
                  </p>
                  <div className="flex items-center gap-1">
                    {mine ? (
                      <>
                        <ActionForm action={toggleNotePin}>
                          <input type="hidden" name="id" value={n.id} />
                          <input type="hidden" name="pinned" value={String(!n.pinned)} />
                          <Button type="submit" variant="subtle" size="sm" aria-label={n.pinned ? 'Unpin note' : 'Pin note'}>{n.pinned ? <PinOff size={13} /> : <Pin size={13} />}</Button>
                        </ActionForm>
                        <NoteDialog action={saveNote} note={n} />
                      </>
                    ) : null}
                    {mine || isFounder ? (
                      <ActionForm action={deleteNote} confirm={{ title: 'Delete this note?', description: 'This cannot be undone.', confirmLabel: 'Delete', danger: true }}>
                        <input type="hidden" name="id" value={n.id} />
                        <Button type="submit" variant="danger" size="sm">Delete</Button>
                      </ActionForm>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
