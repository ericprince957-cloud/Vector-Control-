'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, Users, Send, Handshake, FolderKanban, Wallet,
  XCircle, CheckSquare, BarChart3, UsersRound, Settings, Menu, X, LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/prospects', label: 'Prospects', icon: Users },
  { href: '/outreach', label: 'Outreach', icon: Send },
  { href: '/deals', label: 'Deals', icon: Handshake },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/finance', label: 'Finance', icon: Wallet },
  { href: '/rejections', label: 'Rejections', icon: XCircle },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/staff', label: 'Staff', icon: UsersRound },
  { href: '/settings', label: 'Settings', icon: Settings }
];

function NavLinks({ role, onNavigate }: { role: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV.filter((item) => item.href !== '/staff' || role === 'founder').map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
              active ? 'bg-surface-2 text-gold' : 'text-muted hover:bg-surface-2 hover:text-text'
            )}
          >
            <item.icon size={17} strokeWidth={active ? 2.2 : 1.8} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({ role, fullName, logout }: { role: string; fullName: string; logout: () => Promise<void> }) {
  const [open, setOpen] = useState(false);

  const brand = (
    <div className="flex items-center gap-2 px-6 py-5">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gold font-bold text-black">V</div>
      <div>
        <p className="text-sm font-semibold tracking-wide">Vector Control</p>
        <p className="text-[10px] uppercase tracking-widest text-muted">Vector Codes</p>
      </div>
    </div>
  );

  const footer = (
    <div className="border-t border-line px-4 py-4">
      <p className="truncate text-sm">{fullName}</p>
      <p className="text-xs capitalize text-gold">{role}</p>
      <form action={logout}>
        <button className="mt-3 flex items-center gap-2 text-xs text-muted hover:text-red-400">
          <LogOut size={14} /> Sign out
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface lg:flex">
        {brand}
        <NavLinks role={role} />
        {footer}
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-gold text-sm font-bold text-black">V</div>
          <span className="text-sm font-semibold">Vector Control</span>
        </div>
        <button aria-label="Open menu" onClick={() => setOpen(true)} className="text-muted">
          <Menu size={22} />
        </button>
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-line bg-surface">
            <div className="flex items-center justify-between pr-4">
              {brand}
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="text-muted">
                <X size={20} />
              </button>
            </div>
            <NavLinks role={role} onNavigate={() => setOpen(false)} />
            {footer}
          </div>
        </div>
      ) : null}
    </>
  );
}
