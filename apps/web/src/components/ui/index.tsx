import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { AlertTriangle, Inbox, Loader2, RotateCw, X } from 'lucide-react';
import { EASE_OUT } from '../../lib/motion';

// ---------------------------------------------------------------- Button
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

const VARIANT: Record<Variant, string> = {
  primary: 'bg-primary text-white border-2 border-primary hover:bg-primary-600 hover:border-primary-600 active:bg-primary-700',
  secondary: 'bg-white text-ink border border-line hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700',
  ghost: 'bg-transparent text-muted border border-transparent hover:bg-grid hover:text-ink',
  danger: 'bg-danger text-white border-2 border-danger hover:bg-[#c21f1f]',
  success: 'bg-success text-white border-2 border-success hover:bg-[#13893e]',
};
const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'secondary', size = 'md', loading, icon, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex select-none items-center justify-center rounded-lg font-medium transition-colors duration-150 disabled:opacity-50',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : icon}
      {children}
    </button>
  );
});

// ---------------------------------------------------------------- Card
export function Card({ className, children, hover = false, as = 'section' }: { className?: string; children: ReactNode; hover?: boolean; as?: 'section' | 'div' | 'article' }) {
  const Tag = as;
  return <Tag className={clsx('rounded-lg border border-line bg-surface shadow-card', hover && 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift', className)}>{children}</Tag>;
}

export function CardHeader({ title, subtitle, actions, icon }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3.5">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5 text-primary">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-6 text-ink">{title}</h2>
          {subtitle && <p className="text-[13px] leading-5 text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- Chips and badges
type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'saffron' | 'navy';
const TONE: Record<Tone, string> = {
  neutral: 'bg-grid text-muted border-line',
  primary: 'bg-primary-50 text-primary-700 border-primary-100',
  success: 'bg-success-50 text-success border-[#CDEBD7]',
  warning: 'bg-warning-50 text-warning border-[#F6DDB5]',
  danger: 'bg-danger-50 text-danger border-[#F7CFCF]',
  saffron: 'bg-saffron-50 text-[#B45309] border-[#FBE3B5]',
  navy: 'bg-navy text-white border-navy',
};

export function Chip({ tone = 'neutral', children, className, icon, onClick, active }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode; onClick?: () => void; active?: boolean }) {
  const cls = clsx(
    'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5',
    active ? 'border-primary bg-primary text-white' : TONE[tone],
    onClick && 'cursor-pointer transition-colors hover:border-primary-200',
    className,
  );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {icon}
        {children}
      </button>
    );
  return (
    <span className={cls}>
      {icon}
      {children}
    </span>
  );
}

export function ModeBadge({ mode }: { mode: 'LIVE' | 'DEMO' }) {
  return (
    <span className={clsx('num inline-flex items-center rounded-full border px-1.5 text-[10px] font-semibold uppercase leading-4 tracking-wider', mode === 'LIVE' ? 'border-[#CDEBD7] bg-success-50 text-success' : 'border-[#FBE3B5] bg-saffron-50 text-[#B45309]')}>
      {mode}
    </span>
  );
}

export const STATUS_TONE: Record<string, Tone> = {
  EMPLOYED: 'primary',
  SELF_EMPLOYED: 'saffron',
  APPRENTICE: 'primary',
  UNEMPLOYED: 'warning',
  DROPPED_OUT: 'danger',
  AWAITING: 'neutral',
  VERIFIED: 'success',
  PENDING_VERIFICATION: 'warning',
  REJECTED: 'danger',
  RESPONDED: 'success',
  SENT: 'primary',
  SCHEDULED: 'neutral',
  ESCALATED: 'danger',
  QUEUED: 'warning',
  IN_CALL: 'primary',
  RESOLVED: 'success',
};

// ---------------------------------------------------------------- Skeleton / empty / error
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton rounded-md', className)} aria-hidden />;
}

export function EmptyState({ title, body, icon, action }: { title: string; body?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-grid text-muted">{icon ?? <Inbox className="h-5 w-5" strokeWidth={1.5} />}</div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-[13px] text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, compact }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  const message = error instanceof Error ? error.message : 'The request did not complete.';
  return (
    <div className={clsx('flex items-start gap-3 rounded-lg border border-[#F7CFCF] bg-danger-50 text-danger', compact ? 'p-3' : 'm-4 p-4')}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Could not load this section</p>
        <p className="text-[13px] text-[#9b1c1c]">{message}</p>
      </div>
      {onRetry && (
        <Button size="sm" variant="secondary" icon={<RotateCw className="h-3.5 w-3.5" strokeWidth={1.5} />} onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Form controls
export function Field({ label, hint, error, children, className }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1 block text-[13px] font-medium text-ink">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={clsx(
        'h-9 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink placeholder:text-[#9CA3AF] transition-colors hover:border-[#cfd3da] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100',
        className,
      )}
      {...rest}
    />
  );
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        'h-9 w-full cursor-pointer appearance-none rounded-lg border border-line bg-white bg-[length:16px] bg-[right_8px_center] bg-no-repeat pl-3 pr-8 text-sm text-ink transition-colors hover:border-[#cfd3da] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='1.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200', checked ? 'bg-primary hover:bg-primary-600' : 'bg-[#D1D5DB] hover:bg-[#c3c8cf]', disabled && 'opacity-50')}
    >
      <span className={clsx('inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
    </button>
  );
}

// ---------------------------------------------------------------- Drawer (right side panel)
export function Drawer({ open, onClose, title, subtitle, children, width = 560, footer }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; width?: number; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-navy/30" onClick={onClose} aria-hidden />
          <motion.aside
            role="dialog"
            aria-modal
            className="relative flex h-full w-full flex-col bg-surface shadow-lift"
            style={{ maxWidth: width }}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1, transition: { duration: 0.24, ease: EASE_OUT } }}
            exit={{ x: 40, opacity: 0, transition: { duration: 0.15 } }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-ink">{title}</h2>
                {subtitle && <p className="text-[13px] text-muted">{subtitle}</p>}
              </div>
              <button type="button" onClick={onClose} className="rounded-md p-1 text-muted transition-colors hover:bg-grid hover:text-ink" aria-label="Close">
                <X className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </div>
            <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && <div className="border-t border-line px-6 py-3">{footer}</div>}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------- Modal (centred)
export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-navy/30" onClick={onClose} aria-hidden />
          <motion.div role="dialog" aria-modal className="relative w-full max-w-md rounded-lg border border-line bg-surface shadow-lift" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1, transition: { duration: 0.24, ease: EASE_OUT } }} exit={{ y: 4, opacity: 0 }}>
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="text-[15px] font-semibold">{title}</h2>
              <button type="button" onClick={onClose} className="rounded-md p-1 text-muted transition-colors hover:bg-grid hover:text-ink" aria-label="Close">
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="px-5 py-4">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------- Stat (small label/value pair)
export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="num text-lg font-semibold text-ink">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}
