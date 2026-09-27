import { useEffect, useRef, useState } from 'react';
import type { Variants } from 'framer-motion';

export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE_OUT } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12 } },
};

export const listVariants: Variants = {
  animate: { transition: { staggerChildren: 0.05 } },
};

export const itemVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE_OUT } },
};

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// Animates a number towards `target` over 900 ms. Re-animates from the previous value whenever
// the target changes, so time-travel and live updates visibly "tick".
export function useCountUp(target: number | null | undefined, duration = 900): number | null {
  const [value, setValue] = useState<number | null>(target === null || target === undefined ? null : prefersReducedMotion() ? target : 0);
  const fromRef = useRef<number>(0);
  const currentRef = useRef<number>(0);
  const frame = useRef<number>();
  useEffect(() => {
    if (target === null || target === undefined) {
      setValue(null);
      return;
    }
    if (prefersReducedMotion()) {
      setValue(target);
      fromRef.current = target;
      currentRef.current = target;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (target - from) * eased;
      currentRef.current = v;
      setValue(v);
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      fromRef.current = currentRef.current;
    };
  }, [target, duration]);
  return value;
}
