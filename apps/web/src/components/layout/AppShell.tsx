import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { BarChart3, Building2, ExternalLink, Globe2, LogOut, Menu, MessageCircle, PhoneCall, Plug, ShieldCheck, Users, X } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useDemo } from '../../lib/demo';
import { ModeBadge, Toggle } from '../ui';
import { Logo } from './Logo';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  demoOnly?: boolean;
  external?: boolean;
}

const ICON = 'h-[18px] w-[18px]';
const NAV: Record<string, NavItem[]> = {
  GOVT: [
    { to: '/govt', label: 'Outcomes dashboard', icon: <BarChart3 className={ICON} strokeWidth={1.5} /> },
    { to: '/govt/trainees', label: 'Trainee registry', icon: <Users className={ICON} strokeWidth={1.5} /> },
    { to: '/govt/privacy', label: 'Consent and audit', icon: <ShieldCheck className={ICON} strokeWidth={1.5} /> },
    { to: '/sim/whatsapp', label: 'WhatsApp simulator', icon: <MessageCircle className={ICON} strokeWidth={1.5} />, demoOnly: true, external: true },
    { to: '/public', label: 'Public view', icon: <Globe2 className={ICON} strokeWidth={1.5} />, external: true },
  ],
  PROVIDER: [{ to: '/provider', label: 'Institute dashboard', icon: <Building2 className={ICON} strokeWidth={1.5} /> }],
  AGENT: [{ to: '/agent', label: 'Call queue', icon: <PhoneCall className={ICON} strokeWidth={1.5} /> }],
};

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const { enabled: demoOn, serverDemo, setEnabled, adapters } = useDemo();
  const navigate = useNavigate();
  const items = (NAV[user?.role ?? ''] ?? []).filter((i) => !i.demoOnly || demoOn);
  return (
    <div className="flex h-full flex-col bg-navy text-[#CBD5E1]">
      <div className="px-5 pb-4 pt-5">
        <Logo tone="light" />
        <p className="mt-2 text-[11px] leading-4 text-[#94A3B8]">Skill Development, Employment and Entrepreneurship Department, Government of Maharashtra</p>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/govt'}
            target={item.external ? '_blank' : undefined}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                isActive && !item.external ? 'bg-white/10 text-white' : 'text-[#CBD5E1] hover:bg-white/5 hover:text-white',
              )
            }
          >
            {item.icon}
            <span className="flex-1">{item.label}</span>
            {item.external && <ExternalLink className="h-3.5 w-3.5 text-[#64748B]" strokeWidth={1.5} />}
          </NavLink>
        ))}
      </nav>

      {user?.role === 'GOVT' && serverDemo && (
        <div className="mx-3 mb-3 rounded-lg border border-white/10 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-white">Demo mode</span>
            <Toggle checked={demoOn} onChange={setEnabled} label="Demo mode" />
          </div>
          <p className="mt-1 text-[11px] leading-4 text-[#94A3B8]">Shows the simulation console and the as-of date control.</p>
        </div>
      )}

      <div className="mx-3 mb-3 rounded-lg border border-white/10 px-3 py-2.5">
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[#94A3B8]">
          <Plug className="h-3.5 w-3.5" strokeWidth={1.5} /> Integrations
        </p>
        <ul className="space-y-1">
          {adapters.map((a) => (
            <li key={a.key} className="flex items-center justify-between gap-2 text-[12px]" title={a.detail}>
              <span className="truncate">{a.label}</span>
              <ModeBadge mode={a.mode} />
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
            {user?.name
              .split(' ')
              .map((p) => p[0])
              .join('')
              .slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-white">{user?.name}</p>
            <p className="truncate text-[11px] text-[#94A3B8]">{user?.title}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="rounded-md p-1.5 text-[#94A3B8] transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen lg:pl-[240px]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] lg:block">
        <Sidebar />
      </aside>
      <div className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-line bg-white px-4 lg:hidden">
        <Logo />
        <button type="button" className="rounded-md p-1.5 text-muted transition-colors hover:bg-grid hover:text-ink" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-navy/40" onClick={() => setOpen(false)} />
            <motion.div className="absolute inset-y-0 left-0 w-[260px]" initial={{ x: -20 }} animate={{ x: 0 }} exit={{ x: -20 }}>
              <button type="button" onClick={() => setOpen(false)} className="absolute right-2 top-2 z-10 rounded-md p-1 text-[#94A3B8] hover:text-white" aria-label="Close menu">
                <X className="h-5 w-5" strokeWidth={1.5} />
              </button>
              <Sidebar onNavigate={() => setOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <main className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-7">{children}</main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-medium uppercase tracking-wider text-primary">{eyebrow}</div>}
        <h1 className="text-[22px] font-semibold leading-8 tracking-[-0.01em] text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
