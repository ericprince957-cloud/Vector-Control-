import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { logout } from '@/actions/auth';
import { AppShell, type ShellAlert } from '@/components/app-shell';

async function loadAlerts(role: string): Promise<ShellAlert[]> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);

  const [tasks, followUps, projects, commissions] = await Promise.all([
    supabase.from('tasks').select('id', { count: 'exact', head: true }).in('status', ['todo', 'in_progress']).lt('due_at', nowIso),
    supabase.from('prospects').select('id', { count: 'exact', head: true }).lte('next_follow_up_at', nowIso).not('status', 'in', '(converted,disqualified)'),
    supabase.from('projects').select('id', { count: 'exact', head: true }).not('status', 'in', '(completed,cancelled)').lt('due_date', today),
    role === 'founder'
      ? supabase.from('commission_entries').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      : Promise.resolve({ count: 0 })
  ]);

  const alerts: ShellAlert[] = [];
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (tasks.count) alerts.push({ id: 'tasks', tone: 'red', href: '/tasks', label: `${plural(tasks.count, 'task is', 'tasks are')} overdue` });
  if (projects.count) alerts.push({ id: 'projects', tone: 'red', href: '/projects', label: `${plural(projects.count, 'project is', 'projects are')} past the due date` });
  if (followUps.count) alerts.push({ id: 'followups', tone: 'amber', href: '/prospects', label: `${plural(followUps.count, 'prospect follow-up is', 'prospect follow-ups are')} due` });
  if (commissions.count) alerts.push({ id: 'commissions', tone: 'gold', href: '/commissions', label: `${plural(commissions.count, 'commission awaits', 'commissions await')} approval` });
  return alerts;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const alerts = await loadAlerts(profile.role);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const mustChangePassword = user?.user_metadata?.must_change_password === true;

  return (
    <AppShell
      role={profile.role}
      fullName={profile.full_name || profile.email}
      email={profile.email}
      alerts={alerts}
      mustChangePassword={mustChangePassword}
      logout={logout}
    >
      {children}
    </AppShell>
  );
}
