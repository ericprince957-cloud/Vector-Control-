import { requireProfile } from '@/lib/auth';
import { logout } from '@/actions/auth';
import { Sidebar } from '@/components/sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  return (
    <div className="min-h-screen lg:pl-60">
      <Sidebar role={profile.role} fullName={profile.full_name || profile.email} logout={logout} />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
