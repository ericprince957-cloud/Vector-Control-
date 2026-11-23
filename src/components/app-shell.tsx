'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  LayoutDashboard, Users, Send, Handshake, FolderKanban, Wallet, Receipt, Percent,
  XCircle, CheckSquare, BarChart3, UsersRound, Settings, ScrollText, Menu, X, LogOut,
  PanelLeftClose, PanelLeftOpen, Search, Bell, ChevronDown, ShieldCheck, Sun, Moon, StickyNote, MessagesSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToastProvider } from './toast';

export type ShellAlert = { id: string; label: string; href: string; tone: 'red' | 'amber' | 'gold' };

type Role = 'founder' | 'admin' | 'staff';

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; roles?: Role[] };
type NavGroup = { title: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    title: 'Workspace',
    items: [
      { href: '/overview', label: 'Overview', icon: LayoutDashboard },
      { href: '/tasks', label: 'Tasks', icon: CheckSquare },
      { href: '/notes', label: 'Notes', icon: StickyNote },
      { href: '/chat', label: 'Team chat', icon: MessagesSquare }
    ]
  },
  {
    title: 'Sales',
    items: [
      { href: '/prospects', label: 'Prospects', icon: Users },
      { href: '/outreach', label: 'Outreach', icon: Send },
      { href: '/deals', label: 'Deals', icon: Handshake },
      { href: '/rejections', label: 'Rejections', icon: XCircle }
    ]
  },
  {
    title: 'Delivery',
    items: [{ href: '/projects', label: 'Projects', icon: FolderKanban }]
  },
  {
    title: 'Finance',
    items: [
      { href: '/finance', label: 'Payments', icon: Wallet, roles: ['founder', 'admin'] },
      { href: '/expenses', label: 'Expenses', icon: Receipt, roles: ['founder', 'admin'] },
      { href: '/commissions', label: 'Commissions', icon: Percent },
      { href: '/reports', label: 'Reports', icon: BarChart3, roles: ['founder', 'admin'] }
    ]
  },
  {
    title: 'Administration',
    items: [
      { href: '/staff', label: 'Staff', icon: UsersRound, roles: ['founder'] },
      { href: '/audit', label: 'Audit log', icon: ScrollText, roles: ['founder'] },
      { href: '/settings', label: 'Settings', icon: Settings }
    ]
  }
];

function visible(item: NavItem, role: Role) {
  return !item.roles || item.roles.includes(role);
}

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link href="/overview" className="flex items-center gap-3" aria-label="Vector Control home">
      <Image src="/logo.png" alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-full" priority />
      {!collapsed ? (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold tracking-wide">Vector Control</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Vector Codes</p>
        </div>
      ) : null}
    </Link>
  );
}

function NavLinks({ role, collapsed, onNavigate }: { role: Role; collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="vc-scroll flex-1 overflow-y-auto px-2 pb-4">
      {NAV.map((group) => {
        const items = group.items.filter((i) => visible(i, role));
        if (!items.length) return null;
        return (
          <div key={group.title} className="mt-4 first:mt-1">
            {!collapsed ? (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/70">{group.title}</p>
            ) : (
              <div className="mx-3 mb-1 border-t border-line" aria-hidden />
            )}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      title={collapsed ? item.label : undefined}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex min-h-10 items-center gap-3 rounded-[5px] px-3 py-2 text-sm transition-colors',
                        collapsed && 'justify-center px-0',
                        active ? 'bg-surface-3 text-gold' : 'text-muted hover:bg-surface-2 hover:text-text'
                      )}
                    >
                      <item.icon size={17} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                      {!collapsed ? item.label : <span className="sr-only">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function useOutsideClose(ref: React.RefObject<HTMLElement | null>, close: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [ref, close, active]);
}

function NotificationMenu({ alerts }: { alerts: ShellAlert[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(ref, () => setOpen(false), open);
  const dot = { red: 'bg-danger', amber: 'bg-warn', gold: 'bg-gold' };
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`Notifications${alerts.length ? `, ${alerts.length} need attention` : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(!open)}
        className="relative flex h-10 w-10 items-center justify-center rounded-[5px] text-muted hover:bg-surface-2 hover:text-text"
      >
        <Bell size={18} aria-hidden />
        {alerts.length ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-gold" aria-hidden /> : null}
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-[6px] border border-line-strong bg-surface shadow-xl shadow-black/60">
          <p className="border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Needs attention</p>
          {alerts.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">Nothing needs attention.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {alerts.map((a) => (
                <li key={a.id}>
                  <Link href={a.href} role="menuitem" onClick={() => setOpen(false)} className="flex items-start gap-3 border-b border-line/60 px-4 py-3 text-sm last:border-0 hover:bg-surface-2">
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', dot[a.tone])} aria-hidden />
                    {a.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function UserMenu({ fullName, email, role, logout }: { fullName: string; email: string; role: Role; logout: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(ref, () => setOpen(false), open);
  const initials = fullName.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || 'V';
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        onClick={() => setOpen(!open)}
        className="flex min-h-10 items-center gap-2 rounded-[5px] px-2 hover:bg-surface-2"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-gold/50 text-[11px] font-semibold text-gold">{initials}</span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-32 truncate text-xs font-medium">{fullName}</span>
          <span className="block text-[10px] capitalize text-gold">{role}</span>
        </span>
        <ChevronDown size={14} className="hidden text-muted sm:block" aria-hidden />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-64 rounded-[6px] border border-line-strong bg-surface shadow-xl shadow-black/60">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-medium">{fullName}</p>
            <p className="truncate text-xs text-muted">{email}</p>
          </div>
          <Link href="/settings" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-muted hover:bg-surface-2 hover:text-text">
            <ShieldCheck size={15} aria-hidden /> Account &amp; security
          </Link>
          <form action={logout} className="border-t border-line">
            <button type="submit" role="menuitem" className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-muted hover:bg-surface-2 hover:text-danger">
              <LogOut size={15} aria-hidden /> Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({ role, fullName, email, alerts, mustChangePassword = false, logout, children }: {
  role: Role;
  fullName: string;
  email: string;
  alerts: ShellAlert[];
  mustChangePassword?: boolean;
  logout: () => Promise<void>;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const router = useRouter();
  const pathname = usePathname();

  // Restore sidebar preference (per browser) after hydration.
  useEffect(() => {
    try { setCollapsed(localStorage.getItem('vc-sidebar') === 'collapsed'); } catch { /* storage unavailable */ }
    try {
      const saved = localStorage.getItem('vc-theme');
      const next = saved === 'light' ? 'light' : 'dark';
      setTheme(next);
      document.documentElement.dataset.theme = next;
    } catch { document.documentElement.dataset.theme = 'dark'; }
  }, []);
  useEffect(() => { setDrawer(false); }, [pathname]);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('vc-theme', next); } catch { /* ignore */ }
  }

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem('vc-sidebar', next ? 'collapsed' : 'open'); } catch { /* ignore */ }
  }

  function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/prospects?q=${encodeURIComponent(q)}` : '/prospects');
  }

  return (
    <ToastProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded focus:bg-gold focus:px-3 focus:py-2 focus:text-black">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface transition-[width] duration-150 lg:flex',
          collapsed ? 'w-[68px]' : 'w-60'
        )}
      >
        <div className={cn('flex h-14 shrink-0 items-center border-b border-line', collapsed ? 'justify-center' : 'px-4')}>
          <Brand collapsed={collapsed} />
        </div>
        <NavLinks role={role} collapsed={collapsed} />
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex h-11 items-center justify-center gap-2 border-t border-line text-xs text-muted hover:text-text"
        >
          {collapsed ? <PanelLeftOpen size={16} aria-hidden /> : <><PanelLeftClose size={16} aria-hidden /> Collapse</>}
        </button>
      </aside>

      {/* Mobile drawer */}
      {drawer ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/75" onClick={() => setDrawer(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-surface">
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <Brand />
              <button type="button" aria-label="Close menu" onClick={() => setDrawer(false)} className="flex h-10 w-10 items-center justify-center text-muted">
                <X size={20} />
              </button>
            </div>
            <NavLinks role={role} onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      ) : null}

      <div className={cn('min-h-screen transition-[padding] duration-150', collapsed ? 'lg:pl-[68px]' : 'lg:pl-60')}>
        {/* Top navigation */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-background/95 px-3 backdrop-blur sm:px-6">
          <button type="button" aria-label="Open menu" onClick={() => setDrawer(true)} className="flex h-10 w-10 items-center justify-center rounded-[5px] text-muted hover:bg-surface-2 lg:hidden">
            <Menu size={20} />
          </button>
          <div className="lg:hidden"><Brand collapsed /></div>

          <form onSubmit={search} role="search" className="ml-1 flex-1 sm:max-w-md">
            <label htmlFor="global-search" className="sr-only">Search prospects</label>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <input
                id="global-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search prospects…"
                className="min-h-10 w-full rounded-[5px] border border-line bg-surface pl-9 pr-3 text-sm placeholder:text-muted/60 focus:border-gold/60 focus:outline-none"
              />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={toggleTheme} aria-label={"Switch to " + (theme === "dark" ? "light" : "dark") + " mode"} title={"Switch to " + (theme === "dark" ? "light" : "dark") + " mode"} className="flex h-10 w-10 items-center justify-center rounded-[5px] text-muted hover:bg-surface-2 hover:text-text">
              {theme === "dark" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
            </button>
            <NotificationMenu alerts={alerts} />
            <UserMenu fullName={fullName} email={email} role={role} logout={logout} />
          </div>
        </header>

        {mustChangePassword ? (
          <div role="alert" className="sticky top-0 z-30 border-b border-amber-700 bg-amber-950 px-4 py-2.5 text-sm text-amber-100">
            <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2">
              <p><strong className="font-semibold">Change your password as soon as you log in.</strong> Your account is still using the temporary default password.</p>
              <Link href="/reset-password" className="rounded-[5px] bg-gold px-3 py-1 text-xs font-semibold text-black hover:bg-gold-light">Change password</Link>
            </div>
          </div>
        ) : null}
        <main id="main" className="mx-auto w-full max-w-[1400px] px-3 py-6 sm:px-6">{children}</main>
      </div>
    </ToastProvider>
  );
}
